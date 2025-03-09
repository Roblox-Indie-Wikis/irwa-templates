import { Mwn } from "mwn";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const commitMessage = "Update templates"; //process.env.COMMIT_MESSAGE ?? "Update template";
const commitAuthorName = process.env.COMMIT_AUTHOR_NAME;

type Wiki = {
  apiUrl: string;
  accessToken: string;
};

type Template = {
  filePath: string;
  pageName: string;
};

import wikis from "./data/wikis.json";
import templates from "./data/templates.json";

async function updateTemplateOnWiki(wiki: Wiki) {
  const accessToken = process.env[wiki.accessToken];

  if (!accessToken) {
    throw new Error(`Failed to find access token for wiki ${wiki.apiUrl}!`);
  }

  const bot = await Mwn.init({
    apiUrl: wiki.apiUrl,
    OAuth2AccessToken: accessToken,
    userAgent:
      "RobloxWikiAllianceBot/1.0 (https://github.com/Roblox-Indie-Wikis/Templates)",
    defaultParams: {
      assert: "user",
    },
  });

  templates.forEach(async (template: Template) => {
    const content = fs.readFileSync(template.filePath, "utf-8");

    let editSummary = commitMessage;
    if (commitAuthorName) {
      editSummary += " (" + commitAuthorName + ")";
    }

    console.log(
      "Updating " + template.pageName + " on wiki " + wiki.apiUrl + "..."
    );
    await bot.save(template.pageName, content, editSummary);
  });
}

wikis.forEach(async (wiki: Wiki) => {
  updateTemplateOnWiki(wiki);
});
