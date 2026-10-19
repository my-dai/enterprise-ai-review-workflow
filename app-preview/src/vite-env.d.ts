/// <reference types="vite/client" />

// pdf.js ships its worker without type declarations; it is bundled and handed to pdf.js as globalThis.pdfjsWorker.
declare module 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
