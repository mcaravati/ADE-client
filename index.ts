import type {IADEClient} from "./src/interfaces/IADEClient";
import {createClient} from "./src/clients/ADEClient";

(async () => {
    const client: IADEClient = await createClient();

    const uid = "mcaravati";
    console.log(await client.getStudentPlanning(await client.getADEId(uid)));
})();