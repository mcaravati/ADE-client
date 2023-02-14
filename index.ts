import type {IADEClient, Room} from "./IADEClient";
import {createClient} from "./ADEClient";
import { writeFile } from "fs/promises";

(async () => {
    const client: IADEClient = createClient();

    // You need those 3 calls in that order in order to initialize the client
    await client.initializeADEConnection();
    await client.sendConnectionRequest();
    await client.initProject();

})();