// config.js - Konfigurasi API & Kredensial Utama
export const CONFIG = {
    APP_ID: typeof __app_id !== 'undefined' ? __app_id : 'ayaka-motion-default',
    FIREBASE_CONFIG: JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}'),
    INITIAL_AUTH_TOKEN: typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null,
    
    // Alight Motion Auth Credential
    AM_ORDER_ID: "GPA",
    AM_API_KEY: "AIzaSyDtG1AU22ErnQD60AzBAcaknySiz9_CEq0",
    AM_TOKEN: "mmgaobamlahbbeccfplmbkbb.AO-J1OzqG0or_GJJIx-ms8GrTm-jaglCRfhQSRPUZKpl2YspYS-oN7_94uv8RC5vQbvd_Ios2pPDStZ2n7F0hLE3FiOU7HS3R6Fquulv5xLXFECSv4ctElw",
    AM_SKU_TYPE: "subs",
    AM_FIREBASE_INSTANCE_ID_TOKEN: "cSDnCyp3T-uwp07z3tL86T:APA91bFkmvvsHw5nnqa1SBFci-99DRsKClLiETdRrVcJjS5yBx1v_FbCb1d8WhBuea_zmwnYBktyTIzcRhN4b6uNOUur9wPc0gKXmJDoZic0LhNq5V2s0xI",
    AM_HEADERS: {
        "Content-Type": "application/json",
        "X-Android-Package": "com.alightcreative.motion",
        "X-Android-Cert": "ECA6BF91B8715A6F810ED0BBFC65B6CD578F52A8",
        "User-Agent": "Mozilla/5.0 (Linux; Android 15; Mobile)"
    }
};
