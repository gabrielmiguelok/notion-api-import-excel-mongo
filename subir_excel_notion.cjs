/************************************************************
 * IMPORTS
 ************************************************************/
const { Client } = require("@notionhq/client");
const xlsx = require("xlsx");
const path = require("path");
const readline = require("readline");

/************************************************************
 * VARIABLES Y CONFIGURACIÓN DE COLORES ANSI
 ************************************************************/
let notionAuth = process.env.NOTION_API_KEY || ""; // Si no está definida, se pedirá al usuario
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const PAGE_SIZE = 100; // Cantidad de páginas que se consultan por request a Notion

// Códigos ANSI para colorear la terminal
const ANSI_COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  fgGreen: "\x1b[32m",
  fgCyan: "\x1b[36m",
  fgYellow: "\x1b[33m",
  fgRed: "\x1b[31m",
  fgMagenta: "\x1b[35m",
};

/**
 * colorText: Envuelve un texto en el color dado, devolviendo la versión coloreada.
 */
function colorText(text, colorCode) {
  return `${colorCode}${text}${ANSI_COLORS.reset}`;
}

// Funciones de log con color
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
 * FUNCIONES AUXILIARES DE INTERFAZ (readline, preguntas, etc.)
 ************************************************************/
/**
 * askQuestion: Promesa para usar readline.question.
 * @param {string} query - Mensaje que se muestra al usuario.
 * @returns {Promise<string>} - Respuesta ingresada.
 */
function askQuestion(query) {
  return new Promise((resolve) => {
    rl.question(colorText(query, ANSI_COLORS.fgMagenta), (answer) => {
      resolve(answer);
    });
  });
}

/************************************************************
 * FUNCIONES PARA LEER EXCEL
 ************************************************************/

/**
 * listSheets: Lista las hojas (sheet names) de un archivo XLSX.
 * @param {string} filePath - Ruta completa al archivo XLSX.
 * @returns {string[]} - Nombres de las hojas en el workbook.
 */
function listSheets(filePath) {
  const workbook = xlsx.readFile(filePath);
  return workbook.SheetNames;
}

/**
 * readSheetData: Lee los datos de una hoja de Excel y los retorna como objetos JSON.
 * @param {string} filePath - Ruta completa al archivo XLSX.
 * @param {string} sheetName - Nombre de la hoja a leer.
 * @returns {Object[]} - Arreglo de objetos con los datos.
 */
function readSheetData(filePath, sheetName) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet);
}

/**
 * readSheetHeaders: Lee la primera fila como encabezados.
 * @param {string} filePath - Ruta al archivo XLSX.
 * @param {string} sheetName - Hoja a leer.
 * @returns {string[]} - Lista de encabezados.
 */
function readSheetHeaders(filePath, sheetName) {
  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[sheetName];
  // Con header:1 obtenemos un array de arrays. El primero es la fila de encabezados
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  return rows && rows.length > 0 ? rows[0] : [];
}

/************************************************************
 * FUNCIONES AUXILIARES PARA NOTION
 ************************************************************/

/**
 * initializeNotionClient: Inicializa el cliente de Notion.
 * @returns {Promise<Client>} - Instancia autenticada.
 */
async function initializeNotionClient() {
  if (!notionAuth) {
    notionAuth = await askQuestion("Ingrese su Notion API Key (secret_xxx): ");
  }
  logInfo("Cliente de Notion inicializado.\n");
  return new Client({ auth: notionAuth });
}

/**
 * fetchAllRecords: Trae todas las páginas de la base de datos Notion, paginando.
 * @param {string} databaseId - ID de la base de datos en Notion.
 * @param {Client} notion - Cliente de Notion.
 * @returns {Promise<Object[]>} - Arreglo con todos los registros.
 */
async function fetchAllRecords(databaseId, notion) {
  let allRecords = [];
  let hasMore = true;
  let startCursor = null;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: databaseId,
      page_size: PAGE_SIZE,
      start_cursor: startCursor,
    });
    allRecords = allRecords.concat(response.results);
    hasMore = response.has_more;
    startCursor = response.next_cursor;
  }
  return allRecords;
}

/**
 * getPropertyValue: Extrae el valor en texto según el tipo de propiedad Notion.
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
    case "email":
      return property.email || "";
    case "number":
      return property.number !== null && property.number !== undefined
        ? String(property.number)
        : "";
    case "select":
      return property.select ? property.select.name : "";
    case "status":
      return property.status ? property.status.name : "";
    case "multi_select":
      return property.multi_select
        .map((item) => item.name)
        .join(",");
    case "checkbox":
      return property.checkbox ? "true" : "false";
    default:
      return "";
  }
}

/************************************************************
 * FUNCIONES DE CONSTRUCCIÓN DE PROPIEDADES PARA NOTION
 ************************************************************/

/**
 * buildPropertyPayload: Dado un tipo de propiedad y un valor en string,
 * construye el objeto "properties.<propName>" que Notion requiere.
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
        multi_select: stringValue
          .split(",")
          .map((val) => ({ name: val.trim() })),
      };
    default:
      return { rich_text: [{ text: { content: stringValue } }] };
  }
}

/**
 * buildPagePayload: Construye el objeto con "properties" y "children" (bloques),
 * para crear/actualizar páginas en Notion.
 */
function buildPagePayload(entry, selectedProperties) {
  const properties = {};
  const children = [];

  for (const [header, value] of Object.entries(entry)) {
    const { name: propName, type: propType } = selectedProperties[header];
    const stringValue =
      value !== undefined && value !== null ? String(value) : "";

    properties[propName] = buildPropertyPayload(propType, stringValue);

    // Si es tipo files, añadimos un bloque de imagen.
    if (propType === "files" && stringValue) {
      children.push({
        object: "block",
        type: "image",
        image: {
          type: "external",
          external: { url: stringValue },
        },
      });
    }
  }

  return { properties, children };
}

/************************************************************
 * FUNCIONES PRINCIPALES DE LÓGICA (MAPEO, PROPIEDADES, DUPLICADOS)
 ************************************************************/

/**
 * promptTitleField: Pregunta al usuario cuál de los encabezados será "title" en Notion.
 */
async function promptTitleField(headers) {
  logBright("\nCampos detectados en la hoja:");
  headers.forEach((h, i) => {
    logInfo(`${i + 1}. ${h}`);
  });

  while (true) {
    const answer = await askQuestion(
      "\nSeleccione el número del campo que será 'title' en Notion: "
    );
    const idx = parseInt(answer) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < headers.length) {
      return headers[idx];
    }
    logWarn("Selección inválida. Intente nuevamente.");
  }
}

/**
 * mapProperties: Mapea cada encabezado (columna) a { name, type } en Notion.
 * Si el header es el que seleccionamos para "title", forzamos "type = title".
 * Ofrece la posibilidad de renombrar y cambiar tipo (opción "2").
 */
async function mapProperties(headers, currentProperties, mapOption, titleField) {
  const mappedProperties = {};

  for (const header of headers) {
    let propName = header;
    let propType =
      header === titleField ? "title" : // Forzamos a title si es el campo seleccionado
      currentProperties[header]?.type || "rich_text"; // Si existe en Notion, usamos su tipo, sino "rich_text" x default

    if (mapOption === "2") {
      // Permitir cambiar el nombre
      const newName = await askQuestion(
        `Propiedad "${header}": ¿Cambiar nombre? (Enter para mantener): `
      );
      if (newName.trim() !== "") {
        propName = newName.trim();
      }

      logInfo(`Tipo actual para "${propName}": "${propType}"`);
      const changeType = await askQuestion("¿Cambiar tipo? (s para sí, Enter para no): ");
      if (changeType.trim().toLowerCase() === "s") {
        const propertyTypes = [
          "rich_text",
          "title",
          "number",
          "select",
          "multi_select",
          "date",
          "people",
          "files",
          "checkbox",
          "url",
          "email",
          "phone_number",
          "formula",
          "relation",
          "rollup",
          "created_time",
          "created_by",
          "last_edited_time",
          "last_edited_by",
          "status",
        ];

        logBright("Tipos disponibles:");
        propertyTypes.forEach((type, index) => {
          logInfo(`${index + 1}. ${type}`);
        });

        while (true) {
          const typeChoice = await askQuestion(
            `Selecciona tipo para "${propName}": `
          );
          const selectedIndex = parseInt(typeChoice);
          if (
            !isNaN(selectedIndex) &&
            selectedIndex >= 1 &&
            selectedIndex <= propertyTypes.length
          ) {
            propType = propertyTypes[selectedIndex - 1];
            break;
          } else {
            logWarn("Selección inválida. Intenta nuevamente.");
          }
        }
      }
    }

    mappedProperties[header] = { name: propName, type: propType };
  }
  return mappedProperties;
}

/**
 * ensurePropertiesExist: Verifica en Notion si existen las propiedades mapeadas;
 * si no, las crea; si difiere el tipo, las actualiza.
 */
async function ensurePropertiesExist(databaseId, headers, selectedProperties, notion) {
  try {
    const dbResponse = await notion.databases.retrieve({ database_id: databaseId });
    const currentProps = dbResponse.properties;

    const propsToAdd = {};
    const propsToUpdate = {};

    for (const header of headers) {
      const { name: propName, type: propType } = selectedProperties[header];

      if (!currentProps[propName]) {
        propsToAdd[propName] = { [propType]: {} };
      } else {
        // Si ya existe pero difiere de tipo
        if (currentProps[propName].type !== propType) {
          propsToUpdate[propName] = { [propType]: {} };
        }
      }
    }

    const newProps = Object.keys(propsToAdd);

    if (Object.keys(propsToAdd).length > 0 || Object.keys(propsToUpdate).length > 0) {
      await notion.databases.update({
        database_id: databaseId,
        properties: { ...propsToAdd, ...propsToUpdate },
      });
      logSuccess("Propiedades creadas/actualizadas en la Base de Datos de Notion.\n");
    } else {
      logInfo("No fue necesario crear/actualizar propiedades en Notion.\n");
    }

    return newProps;
  } catch (error) {
    logError("Error al asegurar las propiedades: " + error);
    return [];
  }
}

/************************************************************
 * MANEJO DE DUPLICADOS E INSERCIÓN EN NOTION
 ************************************************************/

/**
 * updateDuplicateRecords: Actualiza registros duplicados (únicamente las propiedades nuevas).
 */
async function updateDuplicateRecords(duplicates, selectedProperties, newProps, notion) {
  for (let i = 0; i < duplicates.length; i++) {
    const { recordId, entry } = duplicates[i];
    const updateOnlyNew = duplicates[i].updateOnlyNewProperties || false;

    const propertiesToUpdate = {};
    for (const [header, value] of Object.entries(entry)) {
      if (updateOnlyNew && !newProps.includes(header)) {
        // Si solo queremos actualizar propiedades nuevas y esta no es nueva, se omite
        continue;
      }
      const { name: propName, type: propType } = selectedProperties[header];
      const stringValue =
        value !== undefined && value !== null ? String(value) : "";
      propertiesToUpdate[propName] = buildPropertyPayload(propType, stringValue);
    }

    try {
      await notion.pages.update({
        page_id: recordId,
        properties: propertiesToUpdate,
      });
      logInfo(`Registro duplicado actualizado: ${entry[Object.keys(entry)[0]] || "Sin título"}`);
    } catch (error) {
      logError(`Error al actualizar duplicado: ${error}`);
    }

    if ((i + 1) % 50 === 0) {
      logBright(`Actualizados ${i + 1} duplicados...`);
    }
  }
}

/**
 * addNonDuplicateRecords: Crea nuevos registros en Notion. Soporta reintento.
 */
async function addNonDuplicateRecords(nonDuplicates, selectedProperties, dbId, notion) {
  const failedRecords = [];

  for (let i = 0; i < nonDuplicates.length; i++) {
    const entry = nonDuplicates[i];
    const { properties, children } = buildPagePayload(entry, selectedProperties);

    try {
      await notion.pages.create({
        parent: { database_id: dbId },
        properties,
        children,
      });
      logSuccess(`Registro agregado: ${entry[Object.keys(entry)[0]] || "Sin título"}`);
    } catch (error) {
      logError(`Error al agregar registro: ${error}`);
      failedRecords.push(entry);
    }

    if ((i + 1) % 50 === 0) {
      logBright(`Agregados ${i + 1} registros...`);
    }
  }

  // Reintentar fallidos
  if (failedRecords.length > 0) {
    logWarn("\nReintentando registros fallidos...");
    const stillFailed = [];

    for (const entry of failedRecords) {
      const { properties, children } = buildPagePayload(entry, selectedProperties);
      try {
        await notion.pages.create({
          parent: { database_id: dbId },
          properties,
          children,
        });
        logSuccess(`Registro agregado tras reintento: ${entry[Object.keys(entry)[0]] || "Sin título"}`);
      } catch (error) {
        logError(`Error en reintento: ${error}`);
        stillFailed.push(entry);
      }
    }

    if (stillFailed.length > 0) {
      logWarn("Algunos registros no pudieron ser exportados incluso tras reintentos.");
      // Aquí se podría guardar en un log, CSV, etc.
    }
  }
}

/**
 * exportToNotion: Aplica la lógica de duplicados (opción 1-omitir, 2-actualizar, 3-sin duplicados).
 */
async function exportToNotion({
  data,
  dbId,
  selectedProperties,
  notion,
  duplicateCheckFields,
  duplicateOption,
  newProperties,
}) {
  // Opción 3 => ignorar duplicados y agregar todos
  if (duplicateOption === "3") {
    logBright("\nNo se chequearán duplicados. Agregando todos los registros...\n");
    await addNonDuplicateRecords(data, selectedProperties, dbId, notion);
    return;
  }

  // Si es 1 o 2 => chequear duplicados
  logBright("\nObteniendo registros existentes en Notion para chequear duplicados...\n");
  const allRecords = await fetchAllRecords(dbId, notion);

  // Crear un Map por cada campo a chequear
  const existingMaps = {};
  for (const field of duplicateCheckFields) {
    existingMaps[field] = new Map();
  }

  // Obtener propiedades actuales y su tipo
  const dbInfo = await notion.databases.retrieve({ database_id: dbId });
  const currProps = dbInfo.properties;

  const propTypeMap = {};
  for (const field of duplicateCheckFields) {
    propTypeMap[field] = currProps[field]?.type || null;
  }

  // Llenamos existingMaps[field] con los valores reales en Notion
  for (const record of allRecords) {
    const props = record.properties;
    for (const field of duplicateCheckFields) {
      if (props[field] && propTypeMap[field]) {
        const val = getPropertyValue(props[field], propTypeMap[field]);
        if (val) {
          existingMaps[field].set(val, record.id);
        }
      }
    }
  }

  const duplicatesToUpdate = [];
  const nonDuplicatesToAdd = [];

  // Chequeamos cada fila
  for (const entry of data) {
    let isDuplicate = false;
    let duplicateRecordId = null;

    // Revisar cada campo configurado para duplicates
    for (const field of duplicateCheckFields) {
      const val = entry[field];
      if (val !== undefined && val !== null) {
        const valStr = String(val);
        if (existingMaps[field].has(valStr)) {
          isDuplicate = true;
          duplicateRecordId = existingMaps[field].get(valStr);
          break;
        }
      }
    }

    if (isDuplicate) {
      if (duplicateOption === "1") {
        // Omitir duplicados
        logInfo(`Registro duplicado omitido. (${Object.keys(entry)[0]}: ${entry[Object.keys(entry)[0]]})`);
      } else if (duplicateOption === "2") {
        // Actualizar solo las propiedades nuevas
        let hasNewProps = false;
        for (const np of newProperties) {
          if (entry[np] !== undefined && entry[np] !== null && entry[np] !== "") {
            hasNewProps = true;
            break;
          }
        }
        if (hasNewProps) {
          duplicatesToUpdate.push({
            recordId: duplicateRecordId,
            entry,
            updateOnlyNewProperties: true,
          });
        }
      }
    } else {
      // No es duplicado
      nonDuplicatesToAdd.push(entry);
    }
  }

  // Procesar duplicados
  if (duplicateOption === "2" && duplicatesToUpdate.length > 0) {
    logInfo(
      `Se encontraron ${duplicatesToUpdate.length} registros duplicados que serán actualizados (solo campos nuevos).`
    );
    await updateDuplicateRecords(duplicatesToUpdate, selectedProperties, newProperties, notion);
  } else if (duplicateOption === "2") {
    logInfo("No se encontraron registros duplicados para actualizar.");
  }

  // Procesar no duplicados
  if (nonDuplicatesToAdd.length > 0) {
    logBright(`\nAgregando ${nonDuplicatesToAdd.length} registros no duplicados...\n`);
    await addNonDuplicateRecords(nonDuplicatesToAdd, selectedProperties, dbId, notion);
  } else {
    logInfo("No se encontraron registros no duplicados para agregar.");
  }
}

/************************************************************
 * FUNCIÓN PRINCIPAL
 ************************************************************/
async function main() {
  try {
    // 1. Inicializar cliente Notion
    const notion = await initializeNotionClient();

    // 2. Solicitar ID de la base de datos
    const databaseIdToInsert = await askQuestion("\nID de la base de datos de Notion: ");

    // 3. Preguntar ruta/nombre del archivo XLSX
    const xlsxFileName = await askQuestion(
      "\nNombre del archivo XLSX (sin extensión): "
    );
    const xlsxFilePath = path.join(__dirname, `${xlsxFileName}.xlsx`);

    // 4. Listar hojas en el XLSX y permitir elegir una
    const sheetNames = listSheets(xlsxFilePath);
    if (sheetNames.length === 0) {
      logError("No se encontraron hojas en el archivo XLSX.");
      rl.close();
      return;
    }

    logBright("\nHojas disponibles en el archivo Excel:");
    sheetNames.forEach((sn, idx) => {
      logInfo(`${idx + 1}. ${sn}`);
    });

    let chosenSheetIndex;
    while (true) {
      const ans = await askQuestion("\nSeleccione el número de la hoja: ");
      const idx = parseInt(ans) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < sheetNames.length) {
        chosenSheetIndex = idx;
        break;
      }
      logWarn("Selección inválida. Intente nuevamente.");
    }
    const chosenSheetName = sheetNames[chosenSheetIndex];

    // 5. Leer headers y datos de la hoja elegida
    const headers = readSheetHeaders(xlsxFilePath, chosenSheetName);
    if (!headers || headers.length === 0) {
      logError("No se encontraron encabezados en la hoja seleccionada.");
      rl.close();
      return;
    }
    const data = readSheetData(xlsxFilePath, chosenSheetName);
    if (data.length === 0) {
      logError("No se encontraron datos en la hoja seleccionada.");
      rl.close();
      return;
    }
    logSuccess(`\nSe encontraron ${data.length} filas en la hoja "${chosenSheetName}".`);

    // 6. Escoger cuál header se usará como "title"
    const titleField = await promptTitleField(headers);

    // 7. Opciones para duplicados
    logBright("\n¿Hay algún campo (o campos) que quieras usar para detectar y/o actualizar duplicados?");
    logInfo("1. Sí, chequear duplicados y omitirlos.");
    logInfo("2. Sí, chequear duplicados y actualizar/agregar los campos faltantes.");
    logInfo("3. No, simplemente agregar todos los registros.");

    let duplicateOption;
    while (true) {
      const ans = await askQuestion("Selecciona una opción (1, 2 o 3): ");
      if (["1", "2", "3"].includes(ans.trim())) {
        duplicateOption = ans.trim();
        break;
      }
      logWarn("Opción inválida. Intente nuevamente.");
    }

    // 8. Si duplicados => pedir campo(s) de Excel a chequear
    let duplicateCheckFields = [];
    if (duplicateOption === "1" || duplicateOption === "2") {
      const fields = await askQuestion(
        "\nIngresa el/los campos de Excel que se usarán para chequear duplicados (separados por coma): "
      );
      duplicateCheckFields = fields
        .split(",")
        .map((f) => f.trim())
        .filter((f) => f && headers.includes(f));

      if (duplicateCheckFields.length === 0) {
        logWarn("\nNo se especificaron campos válidos para duplicados. Se ignorará la detección.");
        duplicateOption = "3"; // Forzamos a ignorar duplicados
      }
    }

    // 9. Obtener propiedades actuales de Notion
    const dbResp = await notion.databases.retrieve({ database_id: databaseIdToInsert });
    const currentProperties = dbResp.properties;

    // 10. Opciones para personalizar tipos (igual que en el script de Mongo)
    logBright("\nOpciones para mapeo de propiedades en Notion:");
    logInfo("1. Mantener nombres y tipos detectados");
    logInfo("2. Personalizar nombres y/o tipos en Notion");
    let mapOption;
    while (true) {
      const ans = await askQuestion("Selecciona una opción (1 o 2): ");
      if (["1", "2"].includes(ans.trim())) {
        mapOption = ans.trim();
        break;
      }
      logWarn("Opción inválida. Intente nuevamente.");
    }

    // 11. Mapear propiedades (usando la que se eligió como "title")
    const selectedProperties = await mapProperties(
      headers,
      currentProperties,
      mapOption,
      titleField
    );

    // 12. Crear/actualizar las propiedades en Notion
    const newProps = await ensurePropertiesExist(
      databaseIdToInsert,
      headers,
      selectedProperties,
      notion
    );

    // 13. Exportar a Notion (manejar duplicados según la opción)
    await exportToNotion({
      data,
      dbId: databaseIdToInsert,
      selectedProperties,
      notion,
      duplicateCheckFields,
      duplicateOption,
      newProperties: newProps,
    });

    // 14. Finalizar
    logSuccess("\nProceso completado con éxito.");
    rl.close();
  } catch (error) {
    logError("\nError general en la ejecución: " + error);
    rl.close();
  }
}

// Ejecutar
main();
