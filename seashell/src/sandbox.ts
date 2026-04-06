import { getRefreshToken } from "./temp/get_google_token";
import dotenv from "dotenv";
import path from "path";
dotenv.config();
const runSandbox = async () => {
  await getRefreshToken();
};
runSandbox().then((e) => console.log("done"));
