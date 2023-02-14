import type { IADEClient, Room } from "./IADEClient";
import { getTimestamp } from "./timestamp";

import axios from "axios";
import type { AxiosResponse } from "axios";
import { config } from "dotenv";
import { fromURL } from "node-ical";
import type { CalendarResponse } from "node-ical";

// Load .env file
config();

let cookies: string[] = [];
let adeCookie: string;
const timestamp = getTimestamp();

// Strictly necessary headers
type Headers = {
    "Content-Type": string;
    Cookie: string;
    "X-GWT-Module-Base": string;
    "X-GWT-Permutation": string;
};

function getHeaders(): Headers {
    return {
        "Content-Type": "text/x-gwt-rpc; charset=utf-8",
        Cookie: cookies.join(";"),
        "X-GWT-Module-Base":
            "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/",
        "X-GWT-Permutation": "B6FB4BD1F96498A84974F1F52B318B82",
    };
}

function createClient(): IADEClient {
    return {
        /**
         * Fetch ADE cookies and log in to the CAS
         */
        async initializeADEConnection(): Promise<void> {
            const getCookiesFromResponse = (response: AxiosResponse) => {
                return response.request.res.headers["set-cookie"][0].split(";")[0];
            };

            const response = await axios.get(
                "https://ade.bordeaux-inp.fr/direct/myplanning.jsp"
            );

            adeCookie = getCookiesFromResponse(response);
            cookies.push(adeCookie);

            // Replace '?' by ';${adeCookie}?' in the url
            const loginUrl = response.request.res.responseUrl.replace(
                "?",
                `;${adeCookie}?`
            );

            const connectionPayload = {
                username: process.env.CAS_USERNAME,
                password: process.env.CAS_PASSWORD,
                lt: "",
                execution: "",
                _eventId: "submit",
                submit: "",
            };

            const ltRegex = /<input type="hidden" name="lt" value="(.*)" \/>/;
            const executionRegex =
                /<input type="hidden" name="execution" value="(.*)" \/>/;
            const submitRegex = /<input .* name="submit" .* value="(.*?)"/;

            // Run regex on response
            const lt = ltRegex.exec(response.data);
            const execution = executionRegex.exec(response.data);
            const submit = submitRegex.exec(response.data);

            if (lt && execution && submit) {
                connectionPayload.lt = lt[1];
                connectionPayload.execution = execution[1];
                connectionPayload.submit = submit[1];
            } else {
                throw new Error("Could not find lt, execution or submit in response");
            }

            const connectionResponse = await axios.post(loginUrl, connectionPayload, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Cookie: adeCookie,
                },
            });
            cookies.push(getCookiesFromResponse(connectionResponse));
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

            await axios.post(url, payload, { headers: getHeaders() });
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

            await axios.post(url, payload, { headers: getHeaders() });
        },
        /**
         * Gets the ADE id of the user
         * @param casUID The CAS UID of the user (ex: mcaravati)
         */
        async getADEId(casUID: string): Promise<number> {
            const url =
                "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy";
            const payload =
                "7|0|13|https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/|067818807965393FC5DCF6AECC2CA8EC|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method7getResourceIds|J|java.util.List|java.util.Map|Z|java.util.ArrayList/4159755760|java.util.HashMap/1797211028|com.adesoft.gwt.directplan.client.rpc.ResourceFieldCriteria/1324434193|java.lang.String/2004016611|" +
                casUID +
                "|1|2|3|4|4|5|6|7|8|" +
                timestamp +
                "|9|0|10|1|11|17|9|1|12|13|0|";

            const response = await axios.post(url, payload, {
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
         * @param folderId The ADE id of the folder
         */
        async getRoomsFromFolder(folderId: string, depth?: number): Promise<Room[]> {
            depth = depth === undefined ? 1 : depth
            const url =
                "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy";
            const payload =
                '7|0|20|https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/|067818807965393FC5DCF6AECC2CA8EC|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"' +
                folderId +
                '""true""'+
                depth
                + '""-1""5""5""0""false"[2]{"ColorField""COLOR""LabelColor""255,255,255""false""false"{"StringField""NAME""LabelName""ENSEIRB-MATMECA""false""false""ENSEIRB-MATMECA""classroom""3""0"[0][0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/1797283245|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/3873584144|1|2|3|4|3|5|6|7|' +
                timestamp +
                "|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|";

            const { data } = await axios.post(url, payload, {
                headers: getHeaders(),
            });
            const roomRegex =
                /{\\"(\d+)(?:\\"){2}(true|false).*?\\"LabelName(?:\\"){2}([(\w-|/)_ ]+)/g;
            // Execute regex on data
            let match = roomRegex.exec(data);
            const rooms: Room[] = [];
            while (match != null) {
                if (match[1] === folderId) {
                    match = roomRegex.exec(data);
                    continue;
                }
                rooms.push({
                    id: match[1],
                    name: match[3],
                    isFolder: match[2] === "true",
                    parent: folderId,
                });
                match = roomRegex.exec(data);
            }

            const buffer: Room[] = [];

            for (const room of rooms) {
                if (room.isFolder) {
                    const roomsFromFolder = await this.getRoomsFromFolder(room.id, depth+1);
                    buffer.push(...roomsFromFolder);
                }
            }

            return rooms.concat(buffer);
        },
        /**
         * Fetches all the rooms from ADE
         */
        async getRooms(): Promise<Room[]> {
            const url =
                "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/DirectPlanningServiceProxy";
            const payload =
                '7|0|20|https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/|067818807965393FC5DCF6AECC2CA8EC|com.adesoft.gwt.directplan.client.rpc.DirectPlanningServiceProxy|method4getChildren|J|java.lang.String/2004016611|com.adesoft.gwt.directplan.client.ui.tree.TreeResourceConfig/2234901663|{"-3""true""0""-1""1""1""0""false"[1]{"StringField""NAME""LabelName""Salles""false""false""""classroom""3""0"[0][0]|[I/2970817851|java.util.LinkedHashMap/3008245022|COLOR|com.adesoft.gwt.core.client.rpc.config.OutputField/870745015|LabelColor||com.adesoft.gwt.core.client.rpc.config.FieldType/1797283245|NAME|LabelName|java.util.ArrayList/4159755760|com.extjs.gxt.ui.client.data.SortInfo/1143517771|com.extjs.gxt.ui.client.Style$SortDir/3873584144|1|2|3|4|3|5|6|7|' +
                timestamp +
                "|8|7|0|9|2|-1|-1|10|0|2|6|11|12|0|13|11|14|15|11|0|0|6|16|12|0|17|16|14|15|4|0|0|18|0|18|0|19|20|1|16|18|0|";

            const { data } = await axios.post(url, payload, {
                headers: getHeaders(),
            });

            const roomRegex =
                /{\\"(\d+)(?:\\"){2}(true|false).*?\\"LabelName(?:\\"){2}([\w-_ ]+)/g;

            // Execute regex on data
            let match = roomRegex.exec(data);
            const rooms: Room[] = [];

            while (match != null) {
                rooms.push({
                    id: match[1],
                    name: match[3],
                    isFolder: match[2] === "true",
                    parent: null,
                });
                match = roomRegex.exec(data);
            }

            const buffer: Room[] = [];
            for (const room of rooms) {

                if (room.isFolder) {
                    const roomsFromFolder = await this.getRoomsFromFolder(room.id);
                    buffer.push(...roomsFromFolder);
                }
            }

            return rooms.concat(buffer);
        },

        async getPlanningForResource(id: string, firstDate: Date, lastDate: Date): Promise<CalendarResponse> {
            const firstDateStr = firstDate.toISOString().split("T")[0]
            const lastDateStr = lastDate.toISOString().split("T")[0]
            const payload = `https://adeapp.bordeaux-inp.fr/jsp/custom/modules/plannings/anonymous_cal.jsp?resources=${id}`
                + `&projectId=1&calType=ical&firstDate=${firstDateStr}&lastDate=${lastDateStr}&displayConfigId=71`
            return await fromURL(payload)
        }
    };
}

export { createClient };
