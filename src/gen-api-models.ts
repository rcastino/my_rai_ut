#!/usr/bin/env node

// tslint:disable:no-console

import * as fs from "fs-extra";
import * as nunjucks from "nunjucks";
import * as prettier from "prettier";
import * as SwaggerParser from "swagger-parser";
import { Spec, Schema } from "swagger-schema-official";


function renderAsync(
  env: nunjucks.Environment,
  definition: Schema,
  definitionName: string
): Promise<string> {
  return new Promise((accept, reject) => {
    env.render("model.ts.njk", {
      definition,
      definitionName
    }, (err, res) => {
      if(err) {
        return reject(err);
      }
      accept(res);
    });
  })
}

export async function renderDefinitionCode(
  env: nunjucks.Environment,
  definitionName: string,
  definition: Schema
): Promise<string> {
  const code = await renderAsync(
    env,
    definition,
    definitionName
  );
  const prettifiedCode = prettier.format(code, {
    parser: "typescript"
  });
  return prettifiedCode;
}

export async function generateApi(
  env: nunjucks.Environment,
  specFilePath: string,
  definitionsDirPath: string,
  tsSpecFilePath: string | undefined
): Promise<void> {
  const api: Spec = await SwaggerParser.bundle(specFilePath);

  const specCode = `
    /* tslint:disable:object-literal-sort-keys */
    /* tslint:disable:no-duplicate-string */

    // DO NOT EDIT
    // auto-generated by generated_model.ts from ${specFilePath}

    export const specs = ${JSON.stringify(api)};
  `;
  if(tsSpecFilePath) {
    console.log(`Writing TS Specs to ${tsSpecFilePath}`);
    await fs.writeFile(
      tsSpecFilePath,
      prettier.format(specCode, {
        parser: "typescript"
      })
    );
  }

  const definitions = api.definitions;
  if (!definitions) {
    console.log("No definitions found, skipping generation of model code.");
    return;
  }

  for (const definitionName in definitions) {
    if (definitions.hasOwnProperty(definitionName)) {
      const definition = definitions[definitionName];
      const outPath = `${definitionsDirPath}/${definitionName}.ts`;
      console.log(`${definitionName} -> ${outPath}`);
      const code = await renderDefinitionCode(
        env,
        definitionName,
        definition
      );
      await fs.writeFile(
        outPath,
        code
      );
    }
  }
}

//
// Configure nunjucks
//

export function initNunJucksEnvironment(): nunjucks.Environment {
  nunjucks.configure({
    trimBlocks: true
  });
  const env = new nunjucks.Environment(
    new nunjucks.FileSystemLoader(`${__dirname}/../templates`)
  );

  env.addFilter("contains", <T>(a: ReadonlyArray<T>, item: T) => {
    return a.indexOf(item) !== -1;
  });

  let seenItems: { [key: string]: true } = {};
  env.addFilter("resetSeen", () => {
    seenItems = {};
  });
  env.addFilter("rememberSeen", (item: string) => {
    seenItems[item] = true;
  });
  env.addFilter("isSeen", (item: string) => {
    return seenItems[item] === true;
  })
  return env;
}
