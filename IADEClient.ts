import type{ CalendarResponse } from "node-ical";


type Room = {
    id: string,
    name: string,
    isFolder: boolean,
    parent: string | null
};

interface IADEClient {
    initializeADEConnection: (casLogin: string, casPassword: string) => Promise<void>,
    sendConnectionRequest: () => Promise<void>,
    initProject: () => Promise<void>,
    getADEId: (_: string) => Promise<number>,
    getRooms: () => Promise<Room[]>,
    getRoomsFromFolder: (_: string, depth?: number) => Promise<Room[]>,
    getPlanningForResource: (id: string, s: Date, e: Date) => Promise<CalendarResponse>
};

export type {
    IADEClient,
    Room,
};