type Room = {
    id: number,
    name: string,
    isFolder: boolean,
    parent: number | null
};

type Student = {
    uid: string,
    name: string,
    surname: string,
    schoolEmail: string,
    personalEmail: string,
    birthDate: string,
    studentId: string,
    cardId: string,
    accountValid: boolean,
    accountEndDate: string,
}

type ADEEvent = {
    start: Date,
    end: Date,
    summary: string | null,
    location: string | null,
    description: {
        id: string | null,
        type: string | null,
        groups: string[],
        teachers: string[],
    }
}

// Strictly necessary headers 
type Headers = {
    "Content-Type": string;
    "X-GWT-Module-Base": string;
    "X-GWT-Permutation": string;
};

export {
    Room,
    Student,
    ADEEvent,
    Headers
};