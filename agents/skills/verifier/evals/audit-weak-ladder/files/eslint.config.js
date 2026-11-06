export default [
  {
    files: ["src/**/*.ts"],
    rules: {
      // Invoices must go through the ledger module, never the db client directly.
      "no-restricted-imports": ["warn", { paths: [{ name: "./db", message: "Use ledger.ts" }] }],
    },
  },
];
