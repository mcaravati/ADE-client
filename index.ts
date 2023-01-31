import type {IADEClient, Room} from "./IADEClient";
import {createClient} from "./ADEClient";

(async () => {
    const client: IADEClient = createClient();

    // You need those 3 calls in that order in order to initialize the client
    await client.initializeADEConnection();
    await client.sendConnectionRequest();
    await client.initProject();

    const uid = 'skhalifa';
    console.log(await client.getADEId(uid));
    let r: Room = {id: "3272", name: "EA-I111/I113", isFolder: false, parent: null}
    await client.getPlanningForRoom(r, new Date(), new Date())
    console.log(r.edt)

})();