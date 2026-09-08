// P0 recovery entrypoint: keep the production path stable while booting only the known-good V15 core.
// V16-V28 remain in the repository but are intentionally excluded from startup until mobile boot is re-certified.
import '../v15/boot.js';
