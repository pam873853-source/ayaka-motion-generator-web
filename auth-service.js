// auth-service.js - Modul Alight Motion Authentication
import { CONFIG } from './config.js';

export class AlightMotionAuthBrowser {
    extractOobCode(fullUrl) {
        if (!fullUrl) return null;
        try {
            let cleanUrl = fullUrl.replace(/&amp;/g, '&');
            try { cleanUrl = decodeURIComponent(cleanUrl); } catch(e) {}
            const match = cleanUrl.match(/[?&]oobCode=([a-zA-Z0-9_-]+)/i) || cleanUrl.match(/oobCode=([a-zA-Z0-9_-]+)/i);
            if (match && match[1]) return match[1];
            return cleanUrl.trim();
        } catch (e) {
            return fullUrl.trim();
        }
    }

    async sendMagicLink(email) {
        try {
            await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/createAuthUri?key=${CONFIG.AM_API_KEY}`, {
                method: 'POST',
                headers: CONFIG.AM_HEADERS,
                body: JSON.stringify({ identifier: email, continueUri: "http://localhost" })
            });
            
            const res = await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/getOobConfirmationCode?key=${CONFIG.AM_API_KEY}`, {
                method: 'POST',
                headers: CONFIG.AM_HEADERS,
                body: JSON.stringify({
                    requestType: 6,
                    email: email,
                    androidInstallApp: true,
                    canHandleCodeInApp: true,
                    continueUrl: "https://alightcreative.com",
                    androidPackageName: "com.alightcreative.motion",
                    clientType: "CLIENT_TYPE_ANDROID"
                })
            });
            if (!res.ok) throw new Error(await res.text());
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async verifyAndApply(email, rawLink, productId) {
        try {
            const oobCode = this.extractOobCode(rawLink);
            if (!oobCode) throw new Error("Gagal mengekstrak oobCode.");
            
            const signinRes = await fetch(`https://www.googleapis.com/identitytoolkit/v3/relyingparty/emailLinkSignin?key=${CONFIG.AM_API_KEY}`, {
                method: 'POST',
                headers: CONFIG.AM_HEADERS,
                body: JSON.stringify({ email: email, oobCode: oobCode, clientType: "CLIENT_TYPE_ANDROID" })
            });
            const signinData = await signinRes.json();
            if (!signinRes.ok || !signinData.idToken) throw new Error("Verifikasi Token Gagal");

            const codeorder = Math.floor(10000 + Math.random() * 90000).toString();
            const purchaseRes = await fetch('https://us-central1-alight-creative.cloudfunctions.net/verifyPurchase', {
                method: 'POST',
                headers: {
                    "authorization": "Bearer " + signinData.idToken,
                    "firebase-instance-id-token": CONFIG.AM_FIREBASE_INSTANCE_ID_TOKEN,
                    "content-type": "application/json; charset=utf-8"
                },
                body: JSON.stringify({
                    data: {
                        productId: productId,
                        token: CONFIG.AM_TOKEN,
                        skuType: CONFIG.AM_SKU_TYPE,
                        orderId: CONFIG.AM_ORDER_ID + "-" + codeorder
                    }
                })
            });
            if (!purchaseRes.ok) throw new Error("Gagal menerapkan pembelian premium");
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
