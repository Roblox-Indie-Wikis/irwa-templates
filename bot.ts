import { Mwn } from "mwn";
import { MwnMissingPageError } from "mwn/build/error";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as crypto from "crypto";

dotenv.config();

const commitMessage = process.env.COMMIT_MESSAGE ?? "Update template";
const commitAuthorName = process.env.COMMIT_AUTHOR_NAME;

type Wiki = {
  apiUrl: string;
  accessToken: string;
  allianceLogoUrl?: string;
};

type Template = {
  filePath: string;
  pageName: string;
};

type File = {
  filePath: string;
  wikiFileName: string;
  fileHash?: string;
};

import wikisData from "./data/wikis.json";
import templatesData from "./data/templates.json";
import filesData from "./data/files.json";

const wikis: Wiki[] = wikisData;
const templates: Template[] = templatesData;
const files: File[] = filesData;

let success = true;

for (const file of files) {
  file.fileHash = computeLocalSHA1(file.filePath);
}

async function updateTemplateOnWiki(wiki: Wiki) {
  const accessToken = process.env[wiki.accessToken];

  if (!accessToken) {
    throw new Error(`❌ Failed to find access token for wiki ${wiki.apiUrl}!`);
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

  for (const template of templates) {
    let content = fs.readFileSync(template.filePath, "utf-8");

    let editSummary = commitMessage;
    if (commitAuthorName) {
      editSummary += ` (${commitAuthorName})`;
    }

    if (wiki.allianceLogoUrl) {
      // replace url on 3rd party wikis
      content = content.replace(
        "https://static.wikitide.net/urbanshadewiki/d/d1/IRWA_Logo.svg",
        wiki.allianceLogoUrl
      );
    }

    try {
      await bot.edit(template.pageName, async (rev) => {
        if (rev.content.trim() === content.trim()) {
          console.log(
            `✅ ${template.pageName} on wiki ${wiki.apiUrl} is up to date!`
          );
          return;
        }
  
        console.log(`ℹ️ Updating ${template.pageName} on wiki ${wiki.apiUrl}...`);
        return {
          text: content,
          summary: editSummary,
          bot: true,
          nocreate: false,
        };
      });
    } catch (error) {
      if (error instanceof MwnMissingPageError) {
        console.log(`ℹ️ Creating ${template.pageName} on wiki ${wiki.apiUrl}...`);
        try {
          await bot.create(template.pageName, content, editSummary);
        } catch (error) {
          success = false;
          console.error(
            `❌ Error creating ${template.pageName} on wiki ${wiki.apiUrl}:`,
            error
          );
        }
        continue;
      }
      success = false;
      console.error(
        `❌ Error updating ${template.pageName} on wiki ${wiki.apiUrl}:`,
        error
      );
    }
  }

  for (const file of files) {
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
        `✅ ${file.wikiFileName} on wiki ${wiki.apiUrl} is up to date!`
      );
      continue;
    }

    console.log(`ℹ️ Updating file ${file.wikiFileName} on wiki ${wiki.apiUrl}...`);

    try {
      await bot.upload(file.filePath, file.wikiFileName, "Update file");
    } catch (error) {
      success = false;
      console.error(
        `❌ Error updating file ${file.wikiFileName} on wiki ${wiki.apiUrl}:`,
        error
      );
    }
  }
}

function computeLocalSHA1(filepath: string): string {
  const fileBuffer = fs.readFileSync(filepath);
  return crypto.createHash("sha1").update(fileBuffer).digest("hex");
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  for (const wiki of wikis) {
    try {
      await updateTemplateOnWiki(wiki);
    } catch (error) {
      success = false;
      console.error(`⚠️ Error updating ${wiki.apiUrl}:`, error);
    }
    // wait 1s between each wiki
    await delay(1000);
  }

  if (success) {
    console.log("✅ All wikis have been updated successfully!");
  } else {
    console.error("⚠️ Some wikis have not been updated successfully!");
    process.exit(1);
  }
})();
