import { google } from "googleapis";
import * as http from "http";
import dotenv from "dotenv";
dotenv.config();

export async function getRefreshToken() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/callback"
  );

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
  });

  console.log("Visit this URL:\n", url);

  return new Promise<void>((resolve) => {
    const server = http.createServer(async (req, res) => {
      const code = new URL(req.url!, "http://localhost:3000").searchParams.get(
        "code"
      );
      if (!code) return;

      const { tokens } = await oauth2Client.getToken(code);
      console.log("\nREFRESH TOKEN:", tokens.refresh_token);

      res.end("Done! You can close this tab.");
      server.close();
      resolve();
    });

    server.listen(3000, () =>
      console.log("Waiting on http://localhost:3000/callback ...")
    );
  });
}
