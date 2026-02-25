import { client } from "../../lib/api/client.gen";

client.setConfig({
  credentials: "include",
});

export { client };
