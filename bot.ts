import { Mwn } from "mwn";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as crypto from "crypto";

dotenv.config();

const commitMessage = "Update templates"; //process.env.COMMIT_MESSAGE ?? "Update template";
const commitAuthorName = process.env.COMMIT_AUTHOR_NAME;

type Wiki = {
  apiUrl: string;
  accessToken: string;
  allianceLogoUrl: string | undefined;
};

type Template = {
  filePath: string;
  pageName: string;
};

type File = {
  filePath: string;
  wikiFileName: string;
  fileHash: string | undefined;
};

import wikis from "./data/wikis.json";
import templates from "./data/templates.json";
import files from "./data/files.json";

files.forEach(async (file: File) => {
  file.fileHash = computeLocalSHA1(file.filePath);
});

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

    if (wiki.allianceLogoUrl) {
      // replace url on 3rd party wikis
      content.replace(
        "https://static.wikitide.net/urbanshadewiki/d/d1/IRWA_Logo.svg",
        wiki.allianceLogoUrl
      );
    }

    await bot.edit(template.pageName, (rev) => {
      if (rev.content.trim() === content.trim()) {
        console.log(
          `Template ${template.pageName} on wiki ${wiki.apiUrl} is up to date!`
        );
        return;
      }

      console.log(`Updating ${template.pageName} on wiki ${wiki.apiUrl}...`);
      return {
        text: content,
        summary: editSummary,
        bot: true,
      };
    });
  });

  files.forEach(async (file: File) => {
    const response = await bot.request({
      action: "query",
      prop: "imageinfo",
      titles: file.wikiFileName,
      iiprop: "sha1",
      format: "json",
    });

    /* eslint-disable  @typescript-eslint/no-explicit-any */
    const result = Object.values(response.query.pages)[0] as any;

    if (
      !result.missing &&
      result.imageinfo &&
      result.imageinfo[0] &&
      result.imageinfo[0].sha1 === file.fileHash
    ) {
      console.log(
        `File ${file.wikiFileName} on wiki ${wiki.apiUrl} is up to date!`
      );
      return;
    }

    console.log(`Updating file ${file.wikiFileName} on wiki ${wiki.apiUrl}...`);
    await bot.upload(file.filePath, file.wikiFileName, "Update file");
  });
}

function computeLocalSHA1(filepath: string): string {
  const fileBuffer = fs.readFileSync(filepath);
  return crypto.createHash("sha1").update(fileBuffer).digest("hex");
}

wikis.forEach(async (wiki: Wiki) => {
  updateTemplateOnWiki(wiki);
});
