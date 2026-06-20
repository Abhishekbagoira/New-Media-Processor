// src/swaggerDef.js

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "AI Media Processing API",
    version: "1.0.0",
    description:
      "AI-powered media processing microservice using Node.js, BullMQ, PostgreSQL, Redis, and ML services.",
  },
  servers: [
    {
      url: "http://localhost:4000",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
};

export default swaggerDefinition;
