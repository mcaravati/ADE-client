type Room = {
    id: string,
    name: string,
    isFolder: boolean,
    parent: string | null
};

interface IADEClient {
    initializeADEConnection: () => Promise<void>,
    sendConnectionRequest: () => Promise<void>,
    initProject: () => Promise<void>,
    getADEId: (string) => Promise<number>,
    getRooms: () => Promise<Room[]>,
    getRoomsFromFolder: (string) => Promise<Room[]>,
};

export {
    IADEClient,
    Room,
};