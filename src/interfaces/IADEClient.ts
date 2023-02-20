import { Room, ADEEvent } from "../types";

interface IADEClient {
    initializeADEConnection: () => Promise<void>,
    sendConnectionRequest: () => Promise<void>,
    initProject: () => Promise<void>,
    getADEId: (casUid: string) => Promise<number>,
    getRooms: () => Promise<Room[]>,
    getRoomsFromFolder: (folderId: number, depth?: number) => Promise<Room[]>,
    getRoomPlanning: (roomId: number, start?: Date, end?: Date) => Promise<ADEEvent[]>,
    getStudentPlanning: (adeId: number, start?: Date, end?: Date) => Promise<ADEEvent[]>,
}

export {
    IADEClient,
};