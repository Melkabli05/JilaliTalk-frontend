/**
 * Generates the `android_apk_signature` login-packet field by reproducing the HMAC the
 * official Android app computes to prove its identity to the messaging server. Ported
 * byte-for-byte from the reference client's `_APK_SIG` object. The HMAC key and APK
 * certificate blob below are not new secrets introduced by this file — they're already
 * committed in plaintext in jilalibff's `ApkSignatureGenerator.java`; this relocates an
 * already-public constant into the browser bundle rather than exposing something new.
 */

const HMAC_KEY_HEX =
  'fe0629ad30d48b5bf1e82865404694fe8525200575f5c4339debf5e8ff571c6e';

const APK_SIG_HEX =
  '3082035930820241a003020102020461e4cac1300d06092a864886f70d01010b0500305c310b30' +
  '0906035504061302434e31123010060355040813096775616e67646f6e673111300f060355040713087368656e7a68656e' +
  '310b3009060355040a13026a79310b3009060355040b13026a79310c300a06035504031303776c683020170d3132313031' +
  '363032303033365a180f32303637303732303032303033365a305c310b300906035504061302434e31123010060355040813' +
  '096775616e67646f6e673111300f060355040713087368656e7a68656e310b3009060355040a13026a79310b30090603550' +
  '40b13026a79310c300a06035504031303776c6830820122300d06092a864886f70d01010105000382010f003082010a0282' +
  '010100947e44daa5fe6b440513b2f206196f9a535da8a2a83841bfb430218322e95b513a5ae62bcea16330027e78557b701c' +
  'c51ca6a02de45820592444244f456182fe6f7acf2283a085fb2258a445c9a3080ce236112bcbaeef77d4cf7fd4fa0e788799c' +
  '2a372ed71b8805c20ed313333599f4db298ea10992e976d96157b642686b357b57dbca4d5ffcae60e8c5e3a77ba6b441e2f04' +
  '194b6209275153199dca2b24845787f6bf777fc274c0b6cfaec2ba73ed84b910334d046234cb31bb094245d6bd00b6371025b' +
  '216b26aef2348dce9c4f90bd8830748f8a82359beb15a9364062c7f1240a340d7d2212bfe77eded19885adb0fe0ac342cb78e' +
  '594927be381aed0203010001a321301f301d0603551d0e04160414a526c8345e98a551da247300ad1feb87a389a106300d06' +
  '092a864886f70d01010b0500038201010037b9a2297d4b21ec2e020306755b12d46e2ef3ac655787f81e1ebe7ed110e24b207' +
  '667462feea52baf8dd115e58a816336ada3a866014afb07459f82ae789300148f291dd361b2be448e0bbe6039811de92b44b6' +
  'cf7c9864bf4d4cc0ab5bb953f401970aecaff8f83012eb5b744fa43af618f79ed0914433aaea1619bad1fc0e1d41a68d072d7' +
  'd7e5961a950b496df5c8a3881e33f7ac2b09cb5613a91f98e0aab8d896be91c80b565ec5d94a44ef17c2dbe109a3204cdaa4c' +
  '9c2e8806e71520af48b9511601c8b7b76da0ec802f896c5c6f8c9c6194da3a3f33a5257365900c6cbf36b64c879b20011e770' +
  'c2c2534d482789c86c0d008287292ffd40de22c41';

const VI_VALUE = '6.3.40(11126,google)';

export const APP_VERSION = VI_VALUE;
export const CURRENT_VERSION = 394024;
export const CHANNEL = 'com.hellotalk.core.app.NihaotalkApplication';

async function hmacHex(keyHex: string, dataStr: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(keyHex);
  const dataBytes = new TextEncoder().encode(dataStr);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, dataBytes);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Builds `android_apk_signature` = HMAC-SHA256(sig1 + tsSec + VI_VALUE + sig2 + deviceId) + tsSec,
 *  where sig1/sig2 are the first 499 / next 499 hex chars of the APK cert blob. */
export async function generateApkSignature(deviceId: string, timestampMs: number = Date.now()): Promise<string> {
  const tsSec = String(Math.floor(timestampMs / 1000));
  const sig1 = APK_SIG_HEX.substring(0, 499);
  const sig2 = APK_SIG_HEX.length > 499 ? APK_SIG_HEX.substring(499, 998) : '';
  const data = sig1 + tsSec + VI_VALUE + sig2 + deviceId;
  const hmac = await hmacHex(HMAC_KEY_HEX, data);
  return hmac + tsSec;
}
