import { config } from "dotenv";
import { IGWTConfig } from "../interfaces/IGWTConfig";

config();

function getConfig(): IGWTConfig {
    return {
        getModuleBase() {
            return process.env.GWT_MODULE_BASE || "https://ade.bordeaux-inp.fr/direct/gwtdirectplanning/";
        },
        getPermutation() {
            return process.env.GWT_PERMUTATION || "B6FB4BD1F96498A84974F1F52B318B82";
        }
    }
}

export {
    getConfig
};