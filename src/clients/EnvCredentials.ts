import { config } from "dotenv";
import { ICredentials } from "../interfaces/ICredentials";

config();

function getConfig(): ICredentials {
    return {
        getUsername() {
            return process.env.CAS_USERNAME || "";
        },
        getPassword() {
            return process.env.CAS_PASSWORD || "";
        }
    }
}

export {
    getConfig
};