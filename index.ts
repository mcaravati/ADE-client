import {IADEClient} from "./IADEClient";
import {createClient} from "./ADEClient";

(async () => {
    const client: IADEClient = createClient();

    // You need those 3 calls in that order in order to initialize the client
    await client.initializeADEConnection();
    await client.sendConnectionRequest();
    await client.initProject();

    const uid = '';
    console.log(await client.getADEId(uid));
})();