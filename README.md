# 🛠️ Open-Source: Importa y Actualiza Datos en **Notion** Desde **Excel** y **MongoDB** de Forma Sencilla

¿Alguna vez quisiste **automatizar la carga de datos** en tus bases de datos de **Notion** y te encontraste copiando y pegando filas interminables de **Excel** o datos de **MongoDB**? Este proyecto **Open-Source** es la solución que estabas buscando.

A continuación, te cuento de qué se trata, cómo funciona y por qué puede ahorrarte **horas de trabajo**.

---

## 📌 Índice

1. [Introducción](#introducción)
2. [Características Principales](#características-principales)
3. [¿Por Qué Te Será Útil?](#por-qué-te-será-útil)
4. [Requisitos](#requisitos)
5. [Instalación](#instalación)
6. [Uso](#uso)
    - [6.1 Importar desde Excel](#61-importar-desde-excel)
    - [6.2 Importar desde MongoDB](#62-importar-desde-mongodb)
7. [Ejemplos de Ejecución](#ejemplos-de-ejecución)
    - [7.1 Importando desde Excel](#71-importando-desde-excel)
    - [7.2 Importando desde MongoDB](#72-importando-desde-mongodb)
8. [Personalización](#personalización)
9. [Contribuciones y Mejora Continua](#contribuciones-y-mejora-continua)
10. [Licencia](#licencia)

---

## Introducción

En muchas ocasiones, necesitamos sincronizar información que tenemos en archivos Excel o en colecciones de MongoDB con **Notion**, ya sea para:

- **Centralizar** tareas, contactos o registros en una **base de datos de Notion**.
- **Actualizar campos** faltantes o inexistentes directamente en Notion.
- **Evitar duplicados** y ahorrar tiempo en limpiezas manuales.

Este repositorio te ofrece **dos scripts** (en Node.js) que abordan estas necesidades de manera fácil y con la posibilidad de **personalizar** tanto los campos como las propiedades en Notion.

> **Repositorio:** [notion-api-import-excel-mongo](https://github.com/gabrielmiguelok/notion-api-import-excel-mongo)

---

## Características Principales

### 📄 Importar desde Excel

- **Selección de Hojas**: Elige la hoja dentro de tu archivo `.xlsx` que deseas importar.
- **Detección Automática de Encabezados**: El script identifica automáticamente los encabezados (columnas) y te guía para mapearlos a las propiedades de Notion.
- **Opciones de Duplicados**: Puedes optar por omitir duplicados, actualizarlos o ignorar el chequeo de duplicados y subir todo.
- **Personalización de Propiedades**: Renombra y cambia el tipo de las propiedades en Notion según tus necesidades.

### 🗄️ Importar desde MongoDB

- **Conexión a MongoDB**: Conecta fácilmente con tu instancia local de **MongoDB**.
- **Selección de Base de Datos y Colección**: Escoge la base de datos y la colección que deseas exportar a Notion.
- **Manejo de Duplicados**: Similar al importador de Excel, puedes elegir cómo manejar los duplicados.
- **Mapeo y Personalización**: Personaliza el mapeo de campos y propiedades para una integración perfecta.

### ⚙️ General

- **Creación/Actualización Automática de Propiedades en Notion**: Si un campo no existe en tu base de datos de Notion, el script lo **crea** automáticamente. Si existe pero con un tipo distinto, lo **actualiza** para que sea compatible.
- **Interfaz Interactiva**: Línea de comandos con **preguntas y respuestas** que te guían durante todo el proceso.
- **Colores en la Terminal**: Distinción clara entre alertas, errores y confirmaciones mediante colores.
- **Registro de Errores y Reintentos**: Si algún registro falla al crearse en Notion, el script hace un **reintento** y te informa si persiste el problema.
- **Soporte para Archivos `.cjs`**: Scripts escritos en CommonJS para una mayor compatibilidad.

---

## ¿Por Qué Te Será Útil?

- **Evitas trabajo repetitivo** al no tener que exportar e importar manualmente filas o documentos.
- **Mantienes coherencia** entre tu información, ya que puedes forzar el chequeo de duplicados o actualizar registros ya creados.
- **Reduces la posibilidad de errores humanos**, pues el script se encarga de emparejar campos y crear propiedades faltantes.
- **Escalable y personalizable**: Con Node.js, puedes modificar el código a tu gusto o integrarlo en pipelines más grandes.

---

## Requisitos

1. **Node.js** (versión 14 o superior).
2. **API Key de Notion** (que puedes crear en [Notion Developers](https://www.notion.so/my-integrations)).
3. **MongoDB** instalado localmente (solo si planeas usar la parte de importación desde MongoDB; si solo usas Excel, no es necesario).
4. **Dependencias de Node.js** que debes instalar dentro de la carpeta del proyecto:

    ```bash
    npm install @notionhq/client xlsx mongodb
    ```

    - `@notionhq/client`: Para interactuar con la API de Notion.
    - `xlsx`: Para leer y procesar archivos Excel (`.xlsx`).
    - `mongodb`: Para conectarse y consultar datos de MongoDB.

> **Nota**: Los módulos `path`, `readline` y otros utilizados en los scripts vienen integrados en Node.js, por lo que no es necesario instalarlos por separado.

---

## Instalación

1. **Clonar el Repositorio**

    ```bash
    git clone https://github.com/gabrielmiguelok/notion-api-import-excel-mongo.git
    cd notion-api-import-excel-mongo
    ```

2. **Instalar Dependencias**

    ```bash
    npm install
    ```

3. **Configurar Variables de Entorno (Opcional)**

    Puedes crear un archivo `.env` en la raíz del proyecto para almacenar tu **API Key de Notion**:

    ```env
    NOTION_API_KEY=tu_api_key_aquí
    ```

    Asegúrate de reemplazar `tu_api_key_aquí` con tu clave real. Esto evita tener que ingresarla manualmente cada vez que ejecutes el script.

---

## Uso

Existen **dos scripts** principales en este repositorio para importar datos a Notion:

- `subir_excel_notion.cjs`: Importa datos desde un archivo Excel (`.xlsx`).
- `subir_mongo_notion.cjs`: Importa datos desde una colección de MongoDB.

### 6.1 Importar desde Excel

1. **Ejecutar el Script**

    ```bash
    node subir_excel_notion.cjs
    ```

2. **Responder a las Preguntas Interactivas**

    - **API Key de Notion**: Si no la has configurado en `.env`, se te pedirá que la ingreses.
    - **ID de la Base de Datos de Notion**: Obtén el ID de la base de datos donde deseas importar los datos.
    - **Nombre del Archivo Excel**: Ingresa el nombre del archivo `.xlsx` (sin la extensión) que deseas importar.
    - **Selección de Hoja**: Elige la hoja dentro del archivo Excel que contiene los datos.
    - **Campo "Title"**: Selecciona cuál de los encabezados de Excel será el campo "title" en Notion.
    - **Opciones de Duplicados**: Decide cómo manejar los registros duplicados.
    - **Mapeo de Propiedades**: Personaliza los nombres y tipos de las propiedades en Notion si lo deseas.

3. **Proceso de Importación**

    El script creará o actualizará las propiedades en Notion según sea necesario y comenzará a importar los datos, mostrando el progreso y cualquier error que ocurra.

### 6.2 Importar desde MongoDB

1. **Ejecutar el Script**

    ```bash
    node subir_mongo_notion.cjs
    ```

2. **Responder a las Preguntas Interactivas**

    - **API Key de Notion**: Si no la has configurado en `.env`, se te pedirá que la ingreses.
    - **ID de la Base de Datos de Notion**: Obtén el ID de la base de datos donde deseas importar los datos.
    - **Conexión a MongoDB**: Asegúrate de que tu instancia de MongoDB esté corriendo localmente.
    - **Selección de Base de Datos y Colección**: Elige la base de datos y la colección que deseas exportar a Notion.
    - **Campo "Title"**: Selecciona cuál de los campos de MongoDB será el campo "title" en Notion.
    - **Opciones de Duplicados**: Decide cómo manejar los registros duplicados.
    - **Mapeo de Propiedades**: Personaliza los nombres y tipos de las propiedades en Notion si lo deseas.

3. **Proceso de Importación**

    Similar al script de Excel, este creará o actualizará las propiedades en Notion y comenzará a importar los datos desde MongoDB, mostrando el progreso y cualquier error que ocurra.

---

## Personalización

- **Creación de Bloques**: Puedes configurar la **creación de bloques** dentro de la página de Notion. Por ejemplo, si un campo es de tipo “files” (con una URL), el script añade un **bloque de imagen** en Notion.
- **Manejo de Duplicados**: Si no te gusta el **manejo de duplicados**, puedes cambiar la lógica en la sección de código `exportToNotion()` en ambos scripts (`subir_excel_notion.cjs` y `subir_mongo_notion.cjs`).
- **Filtros de Datos**: Podrías insertar un paso extra para filtrar ciertas filas de Excel o documentos de MongoDB antes de subirlos.
- **Mapeo Avanzado**: Modifica las funciones de mapeo para adaptar tipos de datos específicos o agregar validaciones adicionales.

---

## Contribuciones y Mejora Continua

¡Tus contribuciones son **bienvenidas**! Puedes:

- **Hacer un fork** del repositorio, crear una rama y enviar un **pull request**.
- **Abrir un issue** reportando problemas o sugiriendo nuevas características.
- **Proponer mejoras** en la documentación o en la lógica de los scripts.

La idea es que entre todos creemos un **ecosistema** más completo para automatizar la integración entre Notion y otras fuentes de datos.

---

## Licencia

Este proyecto está licenciado bajo la MIT License.

---

**Repositorio:** [notion-api-import-excel-mongo](https://github.com/gabrielmiguelok/notion-api-import-excel-mongo)

¡Espero que te resulte útil y te ahorre muchas horas de trabajo!
