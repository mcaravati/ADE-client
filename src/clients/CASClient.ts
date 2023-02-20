import axios, {AxiosInstance} from "axios";
import { ICredentials } from "../interfaces/ICredentials";
import { getConfig } from "./EnvCredentials"; // You can use your own credentials provider

axios.defaults.withCredentials = true;

const config: ICredentials = getConfig();

function createClient() {
    return {
        async connect(service: string, client: AxiosInstance) {
            const response = await client.get(service);

            // Replace '?' by ';${adeCookie}?' in the url
            const regex = /<form id="fm1" class="fm-v clearfix" action="(.+?)" method="post">/g;

            const loginUrl = "https://cas.bordeaux-inp.fr" + regex.exec(response.data)[1];

            const connectionPayload = {
                username: config.getUsername(),
                password: config.getPassword(),
                lt: "",
                execution: "",
                _eventId: "submit",
                submit: "",
            };

            const ltRegex = /<input type="hidden" name="lt" value="(.*)" \/>/;
            const executionRegex =
                /<input type="hidden" name="execution" value="(.*)" \/>/;
            const submitRegex = /<input .* name="submit" .* value="(.*?)"/;

            // Run regex on response
            const lt = ltRegex.exec(response.data);
            const execution = executionRegex.exec(response.data);
            const submit = submitRegex.exec(response.data);

            if (lt && execution && submit) {
                connectionPayload.lt = lt[1];
                connectionPayload.execution = execution[1];
                connectionPayload.submit = submit[1];
            } else {
                throw new Error("Could not find lt, execution or submit in response");
            }

            await client.post(loginUrl, connectionPayload, {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });
        }
    };
}

export { createClient };