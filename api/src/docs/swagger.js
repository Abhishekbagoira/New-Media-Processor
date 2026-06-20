// src/docs/swagger.js

import swaggerJSDoc from "swagger-jsdoc";
import swaggerDefinition from "../swaggerDef.js";

const options = {
  definition: swaggerDefinition,
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;
