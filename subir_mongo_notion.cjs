/************************************************************
 * IMPORTS
 ************************************************************/
const { Client } = require("@notionhq/client");
const { MongoClient } = require("mongodb");
const path = require("path");
const readline = require("readline");

/************************************************************
 * VARIABLES PRINCIPALES (y Helper de Colores)
 ************************************************************/

let notionAuth = process.env.NOTION_API_KEY; // Si no existe, se preguntará en consola.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});
const PAGE_SIZE = 100; // Tamaño de página al leer datos desde Notion.

const ANSI_COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",
  fgBlack: "\x1b[30m",
  fgRed: "\x1b[31m",
  fgGreen: "\x1b[32m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgMagenta: "\x1b[35m",
  fgCyan: "\x1b[36m",
  fgWhite: "\x1b[37m",
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",
};

function colorText(text, colorCode) {
  return `${colorCode}${text}${ANSI_COLORS.reset}`;
}

// Funciones rápidas para logs con color:
function logInfo(msg) {
  console.log(colorText(msg, ANSI_COLORS.fgCyan));
}
function logSuccess(msg) {
  console.log(colorText(msg, ANSI_COLORS.fgGreen));
}
function logWarn(msg) {
  console.log(colorText(msg, ANSI_COLORS.fgYellow));
}
function logError(msg) {
  console.log(colorText(msg, ANSI_COLORS.fgRed));
}
function logBright(msg) {
  console.log(colorText(msg, ANSI_COLORS.bright));
}

/************************************************************
 * FUNCIONES AUXILIARES
 ************************************************************/
/**
 * askQuestion: Envoltorio de readline.question para usar Promesas.
 * @param {string} query - Mensaje que se muestra al usuario.
 * @returns {Promise<string>} - Respuesta ingresada por el usuario.
 */
function askQuestion(query) {
  return new Promise((resolve) => rl.question(colorText(query, ANSI_COLORS.fgMagenta), resolve));
}

/**
 * initializeNotionClient: Inicializa el cliente de Notion con la clave de autenticación.
 * @returns {Promise<Client>} - Instancia de Notion ya autenticada.
 */
async function initializeNotionClient() {
  if (!notionAuth) {
    notionAuth = await askQuestion("Ingrese su Notion API Key (secret_xxx): ");
  }
  logInfo("Cliente de Notion inicializado correctamente.\n");
  return new Client({ auth: notionAuth });
}

/**
 * connectToMongoDB: Conecta al servidor local de MongoDB.
 * @returns {Promise<MongoClient>} - Conexión abierta de MongoClient.
 */
async function connectToMongoDB() {
  const client = new MongoClient("mongodb://localhost:27017");
  await client.connect();
  logSuccess("Conectado a MongoDB exitosamente.\n");
  return client;
}

/**
 * listMongoDatabases: Lista bases de datos en el servidor y las muestra.
 * @param {MongoClient} client - Conexión abierta a Mongo.
 * @returns {Promise<Array<{name: string}>>} - Lista de objetos con name de cada base de datos.
 */
async function listMongoDatabases(client) {
  const adminDb = client.db().admin();
  const { databases } = await adminDb.listDatabases();
  logBright("Bases de datos disponibles en Mongo:");
  databases.forEach((dbObj, index) => {
    logInfo(`${index + 1}. ${dbObj.name}`);
  });
  return databases;
}

/**
 * promptDatabaseSelection: Solicita al usuario seleccionar una de las bases listadas.
 * @param {Array<{name: string}>} databases - Lista de bases devueltas por listMongoDatabases.
 * @returns {Promise<string>} - Nombre de la base de datos escogida.
 */
async function promptDatabaseSelection(databases) {
  while (true) {
    const answer = await askQuestion("\nSeleccione el número de la base de datos: ");
    const idx = parseInt(answer) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < databases.length) {
      return databases[idx].name;
    }
    logWarn("Selección inválida. Intente nuevamente.");
  }
}

/**
 * listCollections: Lista colecciones existentes en la DB y las muestra numeradas.
 * @param {Db} db - Instancia de base de datos de Mongo.
 * @returns {Promise<Array>} - Arreglo de colecciones.
 */
async function listCollections(db) {
  const collections = await db.listCollections().toArray();
  logBright("\nColecciones disponibles:");
  collections.forEach((collection, index) => {
    logInfo(`${index + 1}. ${collection.name}`);
  });
  return collections;
}

/**
 * promptCollectionIndex: Pide al usuario el índice de la colección que desea usar.
 * @param {Array} collections - Lista de colecciones.
 * @returns {Promise<string>} - Nombre de la colección seleccionada.
 */
async function promptCollectionIndex(collections) {
  while (true) {
    const answer = await askQuestion("\nIngrese el número de la colección que desea usar: ");
    const idx = parseInt(answer) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < collections.length) {
      return collections[idx].name;
    }
    logWarn("Selección inválida. Intente nuevamente.");
  }
}

/**
 * readMongoDBData: Lee todos los documentos de una colección de MongoDB.
 * @param {Collection} collection - Colección de Mongo.
 * @returns {Promise<Array<Object>>} - Documentos en un arreglo.
 */
async function readMongoDBData(collection) {
  try {
    const data = await collection.find().toArray();
    return data;
  } catch (error) {
    logError("Error al leer los datos de MongoDB: " + error);
    return [];
  }
}

/**
 * readMongoDBHeaders: Obtiene todos los campos (keys) encontrados en la data de Mongo.
 * @param {Array<Object>} data - Documentos de la colección.
 * @returns {Promise<Array<string>>} - Lista de encabezados.
 */
async function readMongoDBHeaders(data) {
  try {
    const headersSet = new Set();
    data.forEach((doc) => {
      Object.keys(doc).forEach((key) => headersSet.add(key));
    });
    return Array.from(headersSet);
  } catch (error) {
    logError("Error al obtener los encabezados de la colección: " + error);
    return [];
  }
}

/**
 * promptTitleField: Permite elegir cuál de los headers de Mongo se usará como "title" en Notion.
 * @param {Array<string>} headers - Encabezados obtenidos de Mongo.
 * @returns {Promise<string>} - Nombre del header seleccionado para ser "title".
 */
async function promptTitleField(headers) {
  logBright("\nCampos detectados en la colección de Mongo:");
  headers.forEach((h, i) => {
    logInfo(`${i + 1}. ${h}`);
  });

  while (true) {
    const answer = await askQuestion("\nSeleccione el número del campo que será el 'title' en Notion: ");
    const idx = parseInt(answer) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < headers.length) {
      return headers[idx];
    }
    logWarn("Selección inválida. Intente nuevamente.");
  }
}

/**
 * mapProperties: Para cada header, determina su nombre y tipo Notion (por defecto 'rich_text').
 * Sin embargo, uno de los headers será el 'titleField' elegido.
 * Permite personalizar nombre/tipo si la opción de mapeo es '2'.
 * @param {Array<string>} headers - Lista de encabezados de Mongo.
 * @param {Object} currentProperties - Propiedades actuales de la base de datos Notion.
 * @param {string} customizationOption - '2' indica que se pregunta por cambios de nombre y tipo.
 * @param {string} titleField - Campo escogido para ser "title" en Notion.
 * @returns {Promise<Object>} - Mapeo { header: { name, type } }
 */
async function mapProperties(headers, currentProperties, customizationOption, titleField) {
  const mappedProperties = {};

  for (const header of headers) {
    // Por defecto, todo es "rich_text", excepto el que se definió como title.
    let propertyName = header;
    let propertyType = (header === titleField) ? "title" : "rich_text";

    // Si la propiedad ya existe en Notion, usamos su tipo actual (salvo que sea el que forzamos a "title").
    if (currentProperties[header] && header !== titleField) {
      propertyType = currentProperties[header].type;
    }

    // Si la opción es 2, se ofrece personalizar nombre y/o tipo
    if (customizationOption === "2") {
      const newName = await askQuestion(
        `Propiedad "${header}": ¿Cambiar nombre? (Enter para mantener): `
      );
      if (newName.trim() !== "") {
        propertyName = newName.trim();
      }

      logInfo(`Tipo actual para "${propertyName}": "${propertyType}".`);
      const changeType = await askQuestion("¿Cambiar tipo? (s para sí, Enter para no): ");

      if (changeType.trim().toLowerCase() === "s") {
        const propertyTypes = [
          "rich_text", "title", "number", "select", "multi_select",
          "date", "people", "files", "checkbox", "url", "email",
          "phone_number", "formula", "relation", "rollup", "created_time",
          "created_by", "last_edited_time", "last_edited_by", "status"
        ];

        logBright("Tipos disponibles:");
        propertyTypes.forEach((type, index) => {
          logInfo(`${index + 1}. ${type}`);
        });

        while (true) {
          const typeChoice = await askQuestion(
            `Selecciona tipo para "${propertyName}": `
          );
          const selectedIndex = parseInt(typeChoice);
          if (
            !isNaN(selectedIndex) &&
            selectedIndex >= 1 &&
            selectedIndex <= propertyTypes.length
          ) {
            propertyType = propertyTypes[selectedIndex - 1];
            break;
          } else {
            logWarn("Selección inválida. Intenta nuevamente.");
          }
        }
      }
    }

    mappedProperties[header] = { name: propertyName, type: propertyType };
  }

  return mappedProperties;
}

/**
 * ensurePropertiesExist: Verifica y crea/actualiza propiedades en la base de datos de Notion
 * para que coincidan con los campos a exportar.
 * @param {string} databaseIdToInsert - ID de la base de datos de Notion.
 * @param {Array<string>} headers - Encabezados de la colección de Mongo.
 * @param {Object} selectedProperties - Mapeo de cada encabezado a {name, type}.
 * @param {Client} notion - Cliente de Notion.
 * @returns {Promise<Array<string>>} - Lista de propiedades que fueron creadas nuevas.
 */
async function ensurePropertiesExist(databaseIdToInsert, headers, selectedProperties, notion) {
  try {
    const dbResponse = await notion.databases.retrieve({ database_id: databaseIdToInsert });
    const currentProperties = dbResponse.properties;

    const propertiesToAdd = {};
    const propertiesToUpdate = {};

    for (const header of headers) {
      const { name: propName, type: propType } = selectedProperties[header];

      if (!currentProperties[propName]) {
        propertiesToAdd[propName] = { [propType]: {} };
      } else {
        // Si existe y difiere el tipo
        if (currentProperties[propName].type !== propType) {
          propertiesToUpdate[propName] = { [propType]: {} };
        }
      }
    }

    const newProps = Object.keys(propertiesToAdd);

    if (Object.keys(propertiesToAdd).length > 0 || Object.keys(propertiesToUpdate).length > 0) {
      await notion.databases.update({
        database_id: databaseIdToInsert,
        properties: { ...propertiesToAdd, ...propertiesToUpdate }
      });
      logSuccess("Propiedades creadas/actualizadas en la Base de Datos de Notion.\n");
    } else {
      logInfo("No fue necesario crear/actualizar propiedades en Notion.\n");
    }

    return newProps;
  } catch (error) {
    logError("Error al asegurar las propiedades de la base de datos: " + error);
    return [];
  }
}

/**
 * fetchAllRecords: Trae todos los registros (páginas) de una base de datos Notion
 * paginando hasta que no haya más.
 * @param {string} databaseId - ID de la base de datos de Notion.
 * @param {Client} notion - Cliente de Notion.
 * @returns {Promise<Array<Object>>} - Lista de registros (páginas).
 */
async function fetchAllRecords(databaseId, notion) {
  let allRecords = [];
  let hasMore = true;
  let startCursor;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: PAGE_SIZE,
      start_cursor: startCursor
    });
    allRecords = allRecords.concat(response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor;
  }
  return allRecords;
}

/**
 * getPropertyValue: Obtiene el valor en texto plano de una propiedad Notion según su tipo.
 * @param {Object} property - Objeto de propiedad de Notion (p.ej. { url: "..."}).
 * @param {string} type - Tipo de propiedad (url, phone_number, rich_text, title, etc).
 * @returns {string} - Valor en texto.
 */
function getPropertyValue(property, type) {
  if (!property || !type) return "";

  switch (type) {
    case "url":
      return property.url || "";
    case "phone_number":
      return property.phone_number || "";
    case "rich_text":
      return (property.rich_text || []).map((rt) => rt.plain_text).join("");
    case "title":
      return (property.title || []).map((tt) => tt.plain_text).join("");
    default:
      return ""; // Para otros tipos no contemplados, se retorna vacío.
  }
}

/**
 * buildPropertyPayload: Construye el objeto { [tipoDePropiedad]: ... } que Notion requiere para cada campo.
 */
function buildPropertyPayload(propertyType, stringValue) {
  switch (propertyType) {
    case "title":
      return { title: [{ text: { content: stringValue } }] };
    case "files":
      return { files: [{ name: "Archivo", external: { url: stringValue } }] };
    case "date":
      return { date: { start: stringValue } };
    case "checkbox":
      return { checkbox: stringValue.toLowerCase() === "true" };
    case "url":
      return { url: stringValue };
    case "email":
      return { email: stringValue };
    case "phone_number":
      return { phone_number: stringValue };
    case "number":
      return { number: parseFloat(stringValue) };
    case "select":
      return { select: { name: stringValue } };
    case "status":
      return { status: { name: stringValue } };
    case "multi_select":
      return {
        multi_select: stringValue.split(",").map((val) => ({ name: val.trim() }))
      };
    default:
      return { rich_text: [{ text: { content: stringValue } }] };
  }
}

/**
 * buildPagePayload: Construye el objeto completo de creación de página (properties + children).
 */
function buildPagePayload(entry, selectedProperties) {
  const properties = {};
  const children = [];

  for (const [header, value] of Object.entries(entry)) {
    const { name: propName, type: propType } = selectedProperties[header];
    const stringValue = value !== undefined && value !== null ? String(value) : "";

    properties[propName] = buildPropertyPayload(propType, stringValue);

    // Si es tipo "files", añadimos un bloque de imagen
    if (propType === "files" && stringValue) {
      children.push({
        object: "block",
        type: "image",
        image: {
          type: "external",
          external: { url: stringValue }
        }
      });
    }
  }
  return { properties, children };
}

/**
 * updateDuplicateRecords: Actualiza registros duplicados en Notion (únicamente campos nuevos, según requerimiento).
 */
async function updateDuplicateRecords(duplicatesToUpdate, selectedProperties, databaseIdToInsert, newProperties, notion) {
  for (let i = 0; i < duplicatesToUpdate.length; i++) {
    const { recordId, entry, updateOnlyNewProperties = false } = duplicatesToUpdate[i];
    const propertiesToUpdate = {};

    for (const [header, value] of Object.entries(entry)) {
      if (updateOnlyNewProperties && !newProperties.includes(header)) {
        continue;
      }
      const { name: propertyName, type: propertyType } = selectedProperties[header];
      const stringValue = value !== undefined && value !== null ? String(value) : "";
      propertiesToUpdate[propertyName] = buildPropertyPayload(propertyType, stringValue);
    }

    try {
      await notion.pages.update({
        page_id: recordId,
        properties: propertiesToUpdate,
      });
      logInfo(`Registro duplicado actualizado: ${entry[Object.keys(entry)[0]] || "Sin título"}`);
    } catch (error) {
      logError(`Error al actualizar registro duplicado: ${error}`);
    }

    // Mostrar avance cada 100 registros
    if ((i + 1) % 100 === 0) {
      logBright(`Actualizados ${i + 1} registros duplicados.`);
    }
  }
}

/**
 * addNonDuplicateRecords: Crea nuevos registros en la base de datos Notion.
 * Incluye reintentos en caso de error.
 */
async function addNonDuplicateRecords(recordsToAdd, selectedProperties, databaseIdToInsert, notion) {
  const failedRecords = [];

  for (let i = 0; i < recordsToAdd.length; i++) {
    const entry = recordsToAdd[i];
    const { properties, children } = buildPagePayload(entry, selectedProperties);

    try {
      await notion.pages.create({
        parent: { database_id: databaseIdToInsert },
        properties,
        children
      });
      logSuccess(`Registro agregado: ${entry[Object.keys(entry)[0]] || "Sin título"}`);
    } catch (error) {
      logError(`Error al agregar registro: ${error}`);
      failedRecords.push(entry);
    }

    // Mostrar avance cada 100 registros
    if ((i + 1) % 100 === 0) {
      logBright(`Agregados ${i + 1} registros.`);
    }
  }

  // Reintento de los que fallaron
  if (failedRecords.length > 0) {
    logWarn("\nReintentando registros fallidos...");
    const stillFailedRecords = [];

    for (const entry of failedRecords) {
      const { properties, children } = buildPagePayload(entry, selectedProperties);

      try {
        await notion.pages.create({
          parent: { database_id: databaseIdToInsert },
          properties,
          children
        });
        logSuccess(`Registro agregado tras reintento: ${entry[Object.keys(entry)[0]] || "Sin título"}`);
      } catch (error) {
        logError(`Error en reintento: ${error}`);
        stillFailedRecords.push(entry);
      }
    }

    if (stillFailedRecords.length > 0) {
      logWarn("Algunos registros no pudieron ser exportados incluso tras reintentos.");
      // Aquí se podría implementar lógica extra (guardar en un log, etc.).
    }
  }
}

/**
 * exportToNotion: Lógica principal de exportación, filtrando duplicados según
 * la estrategia elegida por el usuario (omitir, actualizar o ignorar duplicados).
 */
async function exportToNotion({
  data,
  databaseIdToInsert,
  selectedProperties,
  notion,
  duplicateCheckFields,
  duplicateOption,
  newProperties
}) {
  // Si no se deben chequear duplicados (opción 3), simplemente agregamos todos
  if (duplicateOption === "3") {
    logBright("\nNo se chequearán duplicados. Agregando todos los registros...\n");
    await addNonDuplicateRecords(data, selectedProperties, databaseIdToInsert, notion);
    return;
  }

  // En caso contrario (1 u 2), necesitamos mapear todos los registros de Notion para detectar duplicados
  logBright("\nObteniendo registros existentes en Notion para chequear duplicados...\n");
  const allRecords = await fetchAllRecords(databaseIdToInsert, notion);

  // Construir un Map por cada campo a chequear
  const existingValuesMap = {};
  for (const field of duplicateCheckFields) {
    existingValuesMap[field] = new Map();
  }

  // Obtener propiedades actuales para conocer los tipos
  const dbInfo = await notion.databases.retrieve({ database_id: databaseIdToInsert });
  const currentProperties = dbInfo.properties;
  const propertyTypeMap = {};
  for (const field of duplicateCheckFields) {
    propertyTypeMap[field] = currentProperties[field]?.type || null;
  }

  // Llenamos existingValuesMap[field] con los valores actuales en Notion
  for (const record of allRecords) {
    const props = record.properties;
    for (const field of duplicateCheckFields) {
      if (props[field] && propertyTypeMap[field]) {
        const value = getPropertyValue(props[field], propertyTypeMap[field]);
        if (value) {
          existingValuesMap[field].set(value, record.id);
        }
      }
    }
  }

  // Separar data entre duplicados y no duplicados
  const duplicatesForUpdate = [];
  const nonDuplicatesToAdd = [];

  for (const doc of data) {
    let isDuplicate = false;
    let duplicateRecordId = null;

    // Revisar cada campo configurado para duplicados
    for (const field of duplicateCheckFields) {
      const docValue = doc[field];
      if (docValue !== undefined && docValue !== null) {
        const docValueStr = String(docValue);
        if (existingValuesMap[field].has(docValueStr)) {
          isDuplicate = true;
          duplicateRecordId = existingValuesMap[field].get(docValueStr);
          break;
        }
      }
    }

    if (isDuplicate) {
      // Opción 1: Omitir duplicados
      // Opción 2: Actualizar duplicados (solo las propiedades nuevas)
      if (duplicateOption === "1") {
        // Omitir => no se hace nada
      } else if (duplicateOption === "2") {
        // Solo actualizar propiedades nuevas
        let hasNewPropertyValues = false;
        for (const prop of newProperties) {
          if (doc[prop] !== undefined && doc[prop] !== null && doc[prop] !== "") {
            hasNewPropertyValues = true;
            break;
          }
        }
        if (hasNewPropertyValues) {
          duplicatesForUpdate.push({
            recordId: duplicateRecordId,
            entry: doc,
            updateOnlyNewProperties: true
          });
        }
      }
    } else {
      nonDuplicatesToAdd.push(doc);
    }
  }

  // Actualizar duplicados (opción 2)
  if (duplicateOption === "2" && duplicatesForUpdate.length > 0) {
    logInfo(`\nSe encontraron ${duplicatesForUpdate.length} registros duplicados para actualizar (solo campos nuevos).`);
    await updateDuplicateRecords(
      duplicatesForUpdate,
      selectedProperties,
      databaseIdToInsert,
      newProperties,
      notion
    );
  } else if (duplicateOption === "2") {
    logInfo("\nNo se encontraron registros duplicados para actualizar.");
  }

  // Agregar registros no duplicados (aplica para opción 1 y 2)
  if (nonDuplicatesToAdd.length > 0) {
    logBright(`\nAgregando ${nonDuplicatesToAdd.length} registros no duplicados...\n`);
    await addNonDuplicateRecords(nonDuplicatesToAdd, selectedProperties, databaseIdToInsert, notion);
  } else {
    logInfo("No se encontraron registros no duplicados para agregar.");
  }
}

/************************************************************
 * FUNCIÓN PRINCIPAL
 ************************************************************/
async function main() {
  try {
    // 1. Inicializar cliente de Notion (pide la API key si no está definida)
    const notion = await initializeNotionClient();

    // 2. Solicitar ID de la base de datos de Notion
    const databaseIdToInsert = await askQuestion("\nID de la base de datos de Notion: ");

    // 3. Conectar a MongoDB
    const mongoClient = await connectToMongoDB();

    // 4. Listar bases de datos y seleccionar una
    const databases = await listMongoDatabases(mongoClient);
    let dbName = await promptDatabaseSelection(databases);
    const db = mongoClient.db(dbName);

    // 5. Listar colecciones y seleccionar una
    const collections = await listCollections(db);
    const collectionName = await promptCollectionIndex(collections);
    const collection = db.collection(collectionName);

    // 6. Leer datos de MongoDB
    const data = await readMongoDBData(collection);
    if (data.length === 0) {
      logError("No se encontraron datos en la colección de MongoDB.");
      rl.close();
      return;
    }
    logSuccess(`\nSe encontraron ${data.length} documentos en la colección "${collectionName}".`);

    // 7. Obtener encabezados
    let headers = await readMongoDBHeaders(data);
    if (headers.length === 0) {
      logError("No se encontraron campos en los documentos de MongoDB.");
      rl.close();
      return;
    }

    // 8. Manejar mapeo del campo _id (si existe)
    if (headers.includes("_id")) {
      const newIdFieldName = await askQuestion('\nIngrese el nombre para exportar el campo "_id": ');
      headers.push(newIdFieldName);
      headers.splice(headers.indexOf("_id"), 1);

      data.forEach((doc) => {
        doc[newIdFieldName] = doc["_id"];
        delete doc["_id"];
      });
      logInfo(`Se ha renombrado "_id" a "${newIdFieldName}".`);
    }

    // 9. Preguntar cuál header será la propiedad "title" en Notion
    const titleField = await promptTitleField(headers);

    // 10. Opciones para duplicados
    logBright("\n¿Hay algún campo que quieras tener en cuenta para no subir enlaces duplicados y/o actualizar los existentes?");
    logInfo("1. Sí, chequear duplicados y omitirlos.");
    logInfo("2. Sí, chequear duplicados y actualizar/agregar los campos faltantes.");
    logInfo("3. No, simplemente agregar todos los registros.");

    let duplicateOption;
    while (true) {
      duplicateOption = await askQuestion("Selecciona una opción (1, 2 o 3): ");
      if (["1", "2", "3"].includes(duplicateOption.trim())) {
        break;
      }
      logWarn("Opción inválida. Intente nuevamente.");
    }

    // 11. Si va a chequear duplicados (opciones 1 o 2), preguntar campos a verificar
    let duplicateCheckFields = [];
    if (duplicateOption === "1" || duplicateOption === "2") {
      const fields = await askQuestion(
        "\nIngresa los nombres de campos a chequear por duplicados (separados por coma): "
      );
      duplicateCheckFields = fields
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f);

      // Filtrar los que realmente estén en headers
      duplicateCheckFields = duplicateCheckFields.filter((f) => headers.includes(f));
      if (duplicateCheckFields.length === 0) {
        logWarn("\nNo se especificaron campos válidos para duplicados. Se continuará sin chequear duplicados.");
        duplicateOption = "3"; // Forzar lógica de no chequeo
      }
    }

    // 12. Obtener propiedades actuales de la base de datos Notion
    const dbResponse = await notion.databases.retrieve({ database_id: databaseIdToInsert });
    const currentProperties = dbResponse.properties;

    // 13. Decidir si se personaliza el mapeo de propiedades (nombres y tipos)
    logBright("\nOpciones para mapeo de propiedades en Notion:");
    logInfo("1. Mantener nombres y tipos detectados");
    logInfo("2. Personalizar nombres y/o tipos en Notion");
    let mapOption;
    while (true) {
      mapOption = await askQuestion("Selecciona una opción (1 o 2): ");
      if (["1", "2"].includes(mapOption.trim())) {
        break;
      }
      logWarn("Opción inválida. Intente nuevamente.");
    }

    // 14. Mapear propiedades (nombre y tipo) según la opción elegida
    const selectedProperties = await mapProperties(headers, currentProperties, mapOption, titleField);

    // 15. Asegurarnos de que esas propiedades existan en Notion (creándolas si no)
    const newProperties = await ensurePropertiesExist(
      databaseIdToInsert,
      headers,
      selectedProperties,
      notion
    );

    // 16. Exportar a Notion siguiendo la lógica de duplicados
    await exportToNotion({
      data,
      databaseIdToInsert,
      selectedProperties,
      notion,
      duplicateCheckFields,
      duplicateOption,
      newProperties
    });

    // 17. Cerrar conexiones
    logSuccess("\nProceso completado con éxito.");
    rl.close();
    mongoClient.close();
  } catch (error) {
    logError("\nError general en la ejecución: " + error);
    rl.close();
  }
}

// Iniciar el proceso
main();
