import type {IADEClient} from "./IADEClient";
import {createClient} from "./ADEClient";

(async () => {
    const client: IADEClient = createClient();

    // You need those 3 calls in that order in order to initialize the client
    //You could do a dotenv.config() then process.env.LOGIN etc...
    await client.initializeADEConnection("YOUR_LOGIN", "YOUR_PASSWORD");
    await client.sendConnectionRequest();
    await client.initProject();
})();