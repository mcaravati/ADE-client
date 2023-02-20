import {IADEClient} from "../interfaces/IADEClient";
import { ADEEvent, Room , Headers} from "../types";
import { getTimestamp } from "../timestamp";

import axios from "axios";
import {CalendarComponent, CalendarResponse, fromURL, VEvent} from "node-ical";
import {createClient as createCASClient} from "./CASClient";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { IGWTConfig } from "../interfaces/IGWTConfig";
import { getConfig } from "./GWTEnvConfig"; // You can change this

// Load config
const config: IGWTConfig = getConfig();

const GWT_MODULE_BASE = config.getModuleBase();
const GWT_PERMUTATION = config.getPermutation();

/**
 * Returns the necessary headers to request ADE's GWT backend through the CAS
 * @returns {Headers} The headers
 */
function getHeaders(): Headers {
    return {
        "Content-Type": "text/x-gwt-rpc; charset=utf-8",
        "X-GWT-Module-Base": GWT_MODULE_BASE,
        "X-GWT-Permutation": GWT_PERMUTATION,
    };
}

/**
 * Fetches ADE's GWT backend to get the the planning related to a given entity
 * @param {number} adeId The ADE id of the entity
 * @param {Date} start The start date of the planning
 * @param {Date} end The end date of the planning
 * @returns {Promise<ADEEvent[]>} The planning
 */
async function _getPlanning(adeId: number, start = new Date(), end = new Date()): Promise<ADEEvent[]> {
    const formatDate = (date: Date): string => date.toISOString().split("T")[0]; // Formats dates to YYYY-MM-DD

    const firstDateStr = formatDate(start);
    const lastDateStr = formatDate(end);

    const payload = `https://adeapp.bordeaux-inp.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=${adeId}&projectId=1&calType=ical&firstDate=${firstDateStr}&lastDate=${lastDateStr}&displayConfigId=71`;

    return _processICALResult(await fromURL(payload)).sort((a, b) => a.start.getTime() - b.start.getTime());
}

function _processICALResult(ical: CalendarResponse): ADEEvent[] {

    /**
     * Turn a string in a more processable format
     * @param {string} str The string to process
     * @returns {string[]} The processed string, split by lines
     */
    const processString = (str: string): string[] => {
        return str.split("\n")
            .map((line: string) => line.startsWith("(Exporté") ? "" : line) // Remove useless lines
            .map((line: string) => line.replace(/\*/g, "")) // Remove '*' from the string
            .map((line: string) => line.replace(/ +/g, " ")) // Remove multiple spaces
            .map((line: string) => line.trim()) // Remove spaces at the beginning and at the end of the string
            .filter((line: string) => line !== ""); // Remove empty lines
    };

    /**
     * Extracts the id, type and teachers from a iCal VEVENT description
     * @param {string[]} str The description to process, split by lines
     * @returns {ADEEvent["description"]} The processed description
     */
    const processDescription = (str: string[]) => {       
        const idIndex = str.findIndex((line: string) => line.match(/^[A-Z0-9]+$/) && line.length >= 5);
        const id = str[idIndex];

        // Remove element from the array
        const withoutId = idIndex > -1 ? str.filter((_, i) => i !== idIndex) : str;

        const typeIndex = withoutId.findIndex((line: string) => (line.split( " ").length == 1) && line.match(/^[A-Z]+$/));
        const type = withoutId[typeIndex];

        // Remove element from the array
        const withoutType = typeIndex > -1 ? str.filter((_, i) => i !== typeIndex) : withoutId;

        // Find all teachers
        const teacherIndexes = withoutType.reduce((acc: number[], line: string, index: number) => {
            const split = line.split(" ");

            // Is considered teacher if:
            // - The line contains more than one word
            // - The first word is all uppercase
            // - The last word capitalized
            // - The line is not already in the array
            if (
                split.length > 1
                && split[0].match(/^[A-ZÀ-ÖØ-Ý-]+$/) // ! NOT SURE 
                && split[split.length - 1].match(/^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+$/) // Handles accents
                && !acc.find((i: number) => i === index)
            ) {
                acc.push(index);
            }

            return acc;
        }, []);

        const teachers = teacherIndexes.map((index: number) => withoutType[index]);
        const withoutTeachers = withoutType.filter((_, i) => !teacherIndexes.includes(i));

        // Find all student groups (ex: E1, I1, M1, R&I1, SEE1, T1, etc.)
        const groups = withoutTeachers.reduce((acc: string[], line: string) => {
            const split = line.split(" ");
            const match = split.find(word => word.match(/^(?:E|I|M|R&I|SEE|T)[0-9]+$/));

            if (match) {
                acc.push(match);
            }

            return acc;
        }, []);

        return {
            id: id || null,
            type: type || null,
            groups, // Empty array if no groups
            teachers, // Empty array if no teachers
        };
    };

    return Object.values(ical)
        .filter((event: CalendarComponent) => event.type === "VEVENT") // Keep only VEVENT, as they are classes
        .map((event) => {
            event = event as VEvent;

            return {
                start: event.start,
                end: event.end,
                summary: processString(event.summary).join(" ") || null,
                location: processString(event.location).join(" ") || null,
                description: processDescription(processString(event.description)),
            };
        });
}

async function createClient(): Promise<IADEClient> {
    
    // Handle cookies for CAS authentication
    const jar = new CookieJar();
    const axiosClient = wrapper(axios.create({ jar }));

    // Create CAS client
    const casClient = createCASClient();

    // Generate key for ADE communication
    const timestamp = getTimestamp();

    const client: IADEClient = {
        /**
         * Fetch ADE cookies and log in to the CAS
         */
        async initializeADEConnection(): Promise<void> {
            await casClient.connect("https://ade.bordeaux-inp.fr/direct/myplanning.jsp", axiosClient);
        },
        /**
         * Sets up timestamp as communication key
         */
        async sendConnectionRequest(): Promise<void> {
            const url =
                "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/MyPlanningClientServiceProxy";
            const payload =
                "7|0|8|https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/|217140C31DF67EF6BA02D106930F5725|com.adesoft.gwt.directplan.client.rpc.MyPlanningClientServiceProxy|method1login|J|com.adesoft.gwt.core.client.rpc.data.LoginRequest/3705388826|com.adesoft.gwt.directplan.client.rpc.data.DirectLoginRequest/635437471||1|2|3|4|2|5|6|" +
                timestamp +
                "|7|0|0|0|1|1|8|8|-1|0|0|";

            await axiosClient.post(url, payload, { headers: getHeaders() });
        },
        /**
         * Initializes the project
         */
        async initProject(): Promise<void> {
            const url =
                "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/WebClientServiceProxy";
            const payload =
                "7|0|7|https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/|34BFB581389200AE2C2012C5A7E57F95|com.adesoft.gwt.core.client.rpc.WebClientServiceProxy|method6loadProject|J|I|Z|1|2|3|4|3|5|6|7|" +
                timestamp +
                "|1|0|";

            await axiosClient.post(url, payload, { headers: getHeaders() });
        },
        /**
         * Gets the ADE id of the user
         * @param {string} casUID The CAS UID of the user (ex: mcaravati)
         */
        async getADEId(casUID: string): Promise<number> {
            const url = "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy";
            const payload = `7|0|13|https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/|067818807965393FC5DCF6AECC2CA8EC|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method7getResourceIds|J|java.util.List|java.util.Map|Z|java.util.ArrayList/4159755760|java.util.HashMap/1797211028|com.adesoft.gwt.directplan.client.rpc.ResourceFieldCriteria/1324434193|java.lang.String/2004016611|${casUID}|1|2|3|4|4|5|6|7|8|${timestamp}|9|0|10|1|11|17|9|1|12|13|0|`;

            const response = await axiosClient.post(url, payload, {
                headers: getHeaders(),
            });

            const adeIdRegex = /\/\/OK\[([0-9]+),/;
            const adeId = adeIdRegex.exec(response.data);

            if (adeId) {
                return parseInt(adeId[1], 10);
            } else {
                throw new Error("Could not find adeId in response");
            }
        },

        /**
         * Recursively gets all the rooms from a folder
         * @param {string} folderId The ADE id of the folder
         */
        async getRoomsFromFolder(folderId: number, depth?: number): Promise<Room[]> {
            if (!depth) {
                depth = 1;
            }

            const url = "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy";
            const payload = "7|0|20|https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/|067818807965393FC5DCF6AECC2CA8EC|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{\"" + folderId + "\"\"" + depth + "\"\"1\"\"-1\"\"5\"\"5\"\"0\"\"false\"[2]{\"ColorField\"\"COLOR\"\"LabelColor\"\"255,255,255\"\"false\"\"false\"{\"StringField\"\"NAME\"\"LabelName\"\"ENSEIRB-MATMECA\"\"false\"\"false\"\"ENSEIRB-MATMECA\"\"classroom\"\"3\"\"0\"[0][0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/1797283245|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/3873584144|1|2|3|4|3|5|6|7|" + timestamp + "|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|";

            const { data } = await axiosClient.post(url, payload, { headers: getHeaders() });

            const roomRegex = /{\\"(\d+)(?:\\"){2}(true|false).*?\\"LabelName(?:\\"){2}([(\w-|/)_ ]+)/g;

            // Execute regex on data
            const rooms: Room[] = [];
            let match: RegExpExecArray | null = null;

            while ((match = roomRegex.exec(data))) {
                const parsedId = parseInt(match[1], 10);

                // Avoid infinite loop
                if (parsedId === folderId) {
                    continue;
                }

                rooms.push({
                    id: parsedId,
                    name: match[3],
                    isFolder: match[2] === "true",
                    parent: folderId,
                });
            }

            // Recursively get rooms from folders
            const buffer: Room[] = [];
            for (const room of rooms) {
                if (room.isFolder) {
                    const roomsFromFolder = await this.getRoomsFromFolder(room.id, depth + 1);
                    buffer.push(...roomsFromFolder);
                }
            }

            return rooms.concat(buffer);
        },
        
        /**
         * Fetches all the rooms from ADE
         * @return {Promise<Room[]>} All the existing rooms
         */
        async getRooms(): Promise<Room[]> {
            const url = "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy";
            const payload = "7|0|20|https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/|067818807965393FC5DCF6AECC2CA8EC|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{\"-3\"\"true\"\"0\"\"-1\"\"1\"\"1\"\"0\"\"false\"[1]{\"StringField\"\"NAME\"\"LabelName\"\"Salles\"\"false\"\"false\"\"\"\"classroom\"\"3\"\"0\"[0][0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/1797283245|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/3873584144|1|2|3|4|3|5|6|7|" + timestamp + "|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|";

            // Fetch data from ADE
            const { data } = await axiosClient.post(url, payload, { headers: getHeaders() });

            const roomRegex = /{\\"(\d+)(?:\\"){2}(true|false).*?\\"LabelName(?:\\"){2}([\w-_ ]+)/g;

            // Execute regex on data
            const rooms: Room[] = [];
            let match: RegExpExecArray | null = null;

            // Find matches
            while ((match = roomRegex.exec(data))) {
                rooms.push({
                    id: parseInt(match[1], 10),
                    name: match[3],
                    isFolder: match[2] === "true",
                    parent: null,
                });
            }

            return rooms
                .concat(await Promise.all(
                    rooms
                        .filter(room => room.isFolder)
                        .map(room => this.getRoomsFromFolder(room.id))
                ).then(buffers => [].concat(...buffers)));
        },

        /**
         * Fetches the planning of a given room
         * @param {number} roomId The ID of the room
         * @param {Date | undefined} firstDate The starting date of the planning
         * @param {Date | undefined} lastDate The ending date of the planning
         * @returns The planning of the room
         */
        async getRoomPlanning(roomId: number, firstDate?: Date, lastDate?: Date): Promise<ADEEvent[]> {
            return _getPlanning(roomId, firstDate, lastDate);
        },

        /**
         * Fetches the planning of a given student
         * @param {number} adeId The ADE ID of the student
         * @param {Date | undefined} firstDate The starting date of the planning 
         * @param {Date | undefined} lastDate The ending date of the planning 
         * @returns The planning of the student
         */
        async getStudentPlanning(adeId: number, firstDate?: Date, lastDate?: Date): Promise<ADEEvent[]> {
            return _getPlanning(adeId, firstDate, lastDate);
        }
    };

    // You need those 3 calls in that order in order to initialize the client
    await client.initializeADEConnection();
    await client.sendConnectionRequest();
    await client.initProject();

    return client;
}

export { createClient };
