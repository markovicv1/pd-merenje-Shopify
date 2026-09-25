import React, { useState, useRef, useEffect, useCallback } from 'react';
import { median, computeCorrectedPd, classifyCardPosition } from './lib/pdMath.js';
import { decomposeFacialMatrix, isPoseFrontal } from './lib/headPose.js';
import { resolveReturnTarget, ALLOWED_ORIGINS } from './lib/returnTarget.js';
import { parseDebugFlags, irisDiameterPx, buildReport, IRIS_H_EDGES } from './lib/debugReport.js';
import { zoomRect, cardPrefill, rawPdFromMarkers, distPx } from './lib/adjustGeometry.js';
import { detectCardEdges, toGray, CARD_DETECT_MIN_CONFIDENCE } from './lib/cardDetect.js';
import { distanceFromCard, vfovPrior, parseVfovOverride } from './lib/cardDistance.js';
import { estimateFaceDistance, distanceStatusMm, evaluateCard, aggregateBurst } from './lib/cardCheck.js';
import { meanLuma, laplacianVariance, eyeForeheadRoi, MIN_LUMA } from './lib/captureGate.js';
import { createVoice, STATUS_PROMPT, STATUS_HOLD_MS } from './lib/voice.js';
import { sfx, unlockSfx, vibrate } from './lib/sfx.js';
import { loadSettings, saveSettings } from './lib/a11ySettings.js';
import AdjustView from './components/AdjustView.jsx';
import { AccessibilityPanel, Caption, IcoAccessibility } from './components/A11y.jsx';

// ── Inline SVGs from Figma export ─────────────────────────────────────────

const LOGO_URL = 'https://opticarka.com/cdn/shop/t/39/assets/opticarka_logo_over_stream_black.png';

const IcoHeaderLogo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#hlogo)">
      <path d="M6.01311 28.5241C6.01311 29.4072 5.25998 30.1209 4.33748 30.1209C3.41498 30.1209 2.66873 29.4066 2.66873 28.5241C2.66873 27.6416 3.41561 26.9141 4.33748 26.9141C5.25936 26.9141 6.01311 27.6347 6.01311 28.5241ZM4.81936 28.3859C4.71873 28.0172 4.42248 27.7772 4.15811 27.8497C3.89311 27.9228 3.76123 28.2791 3.86248 28.6478C3.96373 29.0166 4.25936 29.2566 4.52373 29.1841C4.78811 29.1116 4.92061 28.7547 4.81936 28.3859Z" fill="white"/>
      <path d="M9.87436 28.4734C9.87436 29.3953 9.23123 30.1291 8.36123 30.1291C8.07373 30.1291 7.78123 30.1041 7.56748 29.9497C7.56248 29.9459 7.55623 29.9497 7.55623 29.9553V30.9928C7.55623 31.3516 7.26561 31.6422 6.90686 31.6422H6.33686C6.33248 31.6422 6.32873 31.6391 6.32936 31.6347C6.34186 31.4516 6.34811 31.1591 6.34811 30.9928V27.6553C6.34811 27.6509 6.34498 27.6478 6.34061 27.6478H6.02248C6.01686 27.6478 6.01311 27.6422 6.01498 27.6372C6.09186 27.4628 6.19748 27.1753 6.24998 26.9841C6.25123 26.9809 6.25373 26.9784 6.25748 26.9784H7.54936C7.55373 26.9784 7.55686 26.9816 7.55686 26.9859V27.2603C7.55686 27.2672 7.56498 27.2703 7.56936 27.2659C7.81873 27.0397 8.06998 26.9141 8.43998 26.9141C9.27748 26.9141 9.87498 27.6278 9.87498 28.4728L9.87436 28.4734ZM8.63998 28.5253C8.63998 28.1941 8.39998 27.9216 8.10748 27.9216C7.79561 27.9216 7.52936 28.1941 7.52936 28.5253C7.52936 28.8566 7.78936 29.1297 8.10061 29.1297C8.39311 29.1297 8.63998 28.8628 8.63998 28.5253Z" fill="white"/>
      <path d="M11.6487 27.9772V28.6009C11.6487 28.9903 11.8175 29.1397 12.0712 29.1397C12.1619 29.1397 12.3175 29.1197 12.3631 29.0747V29.4822C12.3631 29.8372 12.0781 30.1334 11.7225 30.1334H11.7131C11.0381 30.1334 10.4475 29.7303 10.4475 28.8478V27.9772H10.0319V26.9841H10.4475V26.7234C10.4475 26.5153 10.4412 26.2884 10.4275 26.1328H11.6681C11.655 26.2884 11.6481 26.5097 11.6481 26.7234V26.9834H12.4531V27.1722C12.4531 27.6166 12.0925 27.9772 11.6481 27.9772H11.6487Z" fill="white"/>
      <path d="M14.1019 29.4269V29.4344C14.1019 29.7881 13.8181 30.0763 13.4644 30.0763H12.8687C12.8819 29.9394 12.895 29.6475 12.895 29.4269V27.6606H12.5562C12.6406 27.505 12.7512 27.1869 12.7962 26.9794H14.1269C14.1337 27.2019 14.1019 29.4269 14.1019 29.4269ZM12.855 26.0312C12.855 25.6669 13.1406 25.375 13.4981 25.375C13.8556 25.375 14.1344 25.6669 14.1344 26.0312C14.1344 26.3956 13.855 26.6806 13.4981 26.6806C13.1412 26.6806 12.855 26.3881 12.855 26.0312Z" fill="white"/>
      <path d="M16.7525 28.7903V30.0447C16.7525 30.0516 16.7469 30.0566 16.74 30.0578C16.5281 30.0778 16.4275 30.1216 16.0962 30.1216C15.0575 30.1216 14.3562 29.4072 14.3562 28.5309C14.3562 27.6547 15.0637 26.9141 16.0962 26.9141C16.3237 26.9141 16.5637 26.9791 16.7256 26.9853V28.2316C16.5894 28.0828 16.4337 27.9522 16.1219 27.9522C15.7906 27.9522 15.5306 28.2122 15.5306 28.5303C15.5306 28.8484 15.7906 29.0953 16.1219 29.0953C16.44 29.0966 16.6287 28.9403 16.7519 28.7903H16.7525Z" fill="white"/>
      <path d="M20.165 29.2122V29.4047C20.165 29.8153 19.8293 30.1528 19.4181 30.1534C19.0675 30.1534 18.8925 30.0234 18.7625 29.8353C18.5737 30.0441 18.34 30.1541 18.0218 30.1541C17.4306 30.1541 17.035 29.7709 17.035 29.1934C17.035 28.6159 17.4181 28.1928 18.0675 28.1928C18.3206 28.1928 18.5543 28.2578 18.6456 28.3159V28.1928C18.6456 27.9203 18.4375 27.7778 18.0937 27.7778C17.75 27.7778 17.4831 27.9078 17.3012 28.0828V27.1416C17.5737 27.0053 17.8012 26.9141 18.4443 26.9141C19.3987 26.9141 19.8206 27.4791 19.8206 28.3297V29.0053C19.8206 29.1872 19.8987 29.2447 19.9893 29.2447C20.0475 29.2447 20.1193 29.2384 20.165 29.2122ZM18.425 28.9272C18.2881 28.9272 18.1781 29.0309 18.1781 29.1547C18.1781 29.2953 18.295 29.4009 18.4362 29.3947C18.5187 29.3909 18.5956 29.3422 18.6375 29.2716C18.7368 29.1047 18.6025 28.9272 18.425 28.9278V28.9272Z" fill="white"/>
      <path d="M22.5906 26.9397V28.1997C22.4869 28.1278 22.3306 28.0509 22.1425 28.0509C21.7656 28.0509 21.6362 28.4791 21.6362 28.7459V29.4334C21.6362 29.7884 21.3531 30.0766 20.9987 30.0766H20.4025C20.415 29.8628 20.4225 29.6416 20.4225 29.4272V27.6541H20.085C20.17 27.4653 20.28 27.1741 20.325 26.9791H21.5069V27.6478C21.6237 27.2191 21.9356 26.9141 22.3575 26.9141C22.5319 26.9141 22.5187 26.9397 22.5906 26.9397Z" fill="white"/>
      <path d="M26.4412 30.0794H24.9606C24.8894 29.9563 24.7331 29.7544 24.0387 28.8394V29.43C24.0387 29.7888 23.7481 30.0794 23.39 30.0794H22.8056C22.8256 29.9363 22.8319 29.6444 22.8319 29.43V25.9881H22.4944C22.5656 25.8194 22.6831 25.495 22.7281 25.3125H24.0662C24.0662 25.8375 24.04 28.2019 24.04 28.2019C24.525 27.4606 24.6987 27.1844 24.8062 26.9819H26.04C25.8456 27.2281 25.7281 27.3969 25.085 28.365C25.9737 29.5594 26.1237 29.7219 26.4419 30.0794H26.4412Z" fill="white"/>
      <path d="M29.3469 29.2122V29.4047C29.3469 29.8153 29.0112 30.1528 28.6 30.1534C28.2494 30.1534 28.0744 30.0234 27.9444 29.8353C27.7556 30.0441 27.5219 30.1541 27.2037 30.1541C26.6125 30.1541 26.2169 29.7709 26.2169 29.1934C26.2169 28.6159 26.6 28.1928 27.2494 28.1928C27.5025 28.1928 27.7362 28.2578 27.8275 28.3159V28.1928C27.8275 27.9203 27.6194 27.7778 27.2756 27.7778C26.9319 27.7778 26.6656 27.9078 26.4831 28.0828V27.1416C26.7556 27.0053 26.9831 26.9141 27.6262 26.9141C28.5806 26.9141 29.0031 27.4791 29.0031 28.5631V29.0053C29.0031 29.1872 29.0812 29.2447 29.1719 29.2447C29.23 29.2447 29.3019 29.2384 29.3475 29.2122H29.3469ZM27.6062 28.9272C27.4694 28.9272 27.3594 29.0309 27.3594 29.1547C27.3594 29.2953 27.4762 29.4009 27.6175 29.3947C27.7 29.3909 27.7762 29.3422 27.8187 29.2716C27.9181 29.1047 27.7837 28.9272 27.6062 28.9278V28.9272Z" fill="white"/>
      <path d="M16.0844 25.3984H16.9675L15.9806 26.5928H15.7269L14.7144 25.3984H15.6431L15.8637 25.7234L16.0844 25.3984Z" fill="white"/>
      <path d="M26.105 12.5291C26.105 17.8609 21.5556 22.1741 15.9869 22.1741C10.4181 22.1741 5.91061 17.8609 5.91061 12.5291C5.91061 7.19719 10.4219 2.80469 15.9875 2.80469C21.5531 2.80469 26.1056 7.15719 26.1056 12.5284L26.105 12.5291ZM18.8962 11.6966C18.2881 9.47031 16.4987 8.02094 14.9031 8.45781C13.3044 8.89781 12.5056 11.0528 13.1169 13.2791C13.7287 15.5053 15.515 16.9547 17.11 16.5178C18.7056 16.0816 19.5081 13.9259 18.8962 11.6966Z" fill="white"/>
      <path d="M0 0V32H32V0H0ZM31.625 0.375V23.625H0.375V0.375H31.625ZM31.625 31.625H0.375V24H31.625V31.625Z" fill="white"/>
    </g>
    <defs><clipPath id="hlogo"><rect width="32" height="32" fill="white"/></clipPath></defs>
  </svg>
);

const IcoAiBadge = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 0C9.01217 3.92378 12.0762 6.98783 16 8C12.0762 9.01217 9.01217 12.0762 8 16C6.98783 12.0762 3.92378 9.01217 0 8C3.92378 6.98783 6.98783 3.92378 8 0Z" fill="black"/>
    <path d="M13.839 0C13.839 0.99243 14.98 2.16074 15.9997 2.16074C14.9407 2.16074 13.839 3.31695 13.839 4.32147C13.839 3.3104 12.6685 2.16074 11.6782 2.16074C12.7078 2.16074 13.839 0.99243 13.839 0Z" fill="black"/>
  </svg>
);

// Eye icon — DEFAULT (open) and VARIANT (closed) differ only in the 4th path
const EYE_PATH_OPEN   = "M34.0588 0.000897306C16.3473 0.139269 4.30924 15.8855 0.237757 24.2099C0.080332 24.5318 0.0631652 24.8963 0.176471 25.2362C3.94118 33.2362 15.9882 2 34.0588 2C50.9084 2 63.1347 28.8509 68.0481 25.8508C68.854 25.3587 68.7622 24.2118 68.3073 23.3843C63.575 14.7765 51.2129 -0.133119 34.0588 0.000897306Z";
const EYE_PATH_CLOSED = "M34.0588 0.000897306C16.3473 0.139269 4.30924 15.8855 0.237757 24.2099C0.080332 24.5318 0.0631652 24.8963 0.176471 25.2362C3.94118 33.2362 15.9882 48.7638 34.0588 48.7638C51.2012 48.7638 63.5581 34.4729 68.2975 26.0246C68.7596 25.201 68.7622 24.2118 68.3073 23.3843C63.575 14.7765 51.2129 -0.133119 34.0588 0.000897306Z";

const IcoEye = ({ variant = 'open', size = 69 }) => {
  const h = Math.round(size * 50 / 69);
  const eyelidPath = variant === 'open' ? EYE_PATH_OPEN : EYE_PATH_CLOSED;
  return (
    <svg width={size} height={h} viewBox="0 0 69 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M34.0588 0.000897306C16.3473 0.139269 4.30924 15.8855 0.237757 24.2099C0.0803319 24.5318 0.0631652 24.8963 0.176471 25.2362C3.94118 33.2362 15.9882 49.2362 34.0588 49.2362C51.2032 49.2362 63.5611 34.5167 68.2992 26.0252C68.7594 25.2006 68.7622 24.2118 68.3073 23.3843C63.575 14.7765 51.2129 -0.133119 34.0588 0.000897306Z" fill="#121724"/>
      <circle cx="34.4118" cy="24.5303" r="18.1765" fill="white"/>
      <path d="M34.4122 11.6481C41.5267 11.6484 47.2939 17.4155 47.2941 24.53C47.2941 31.6445 41.5267 37.4125 34.4122 37.4128C27.2975 37.4128 21.5294 31.6447 21.5294 24.53C21.5294 24.2111 21.5408 23.8948 21.5636 23.5817C22.6269 24.0381 23.7981 24.2927 25.0284 24.2927C29.8843 24.2924 33.8203 20.3555 33.8204 15.4997C33.8204 14.1498 33.5154 12.8712 32.9718 11.7282C33.4446 11.6756 33.9254 11.6481 34.4122 11.6481Z" fill="#121724"/>
      <path d={eyelidPath} fill="#121724"/>
    </svg>
  );
};

const IcoCardGraphic = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="20" height="14" rx="1" fill="#D9D9D9"/>
    <rect y="2.33331" width="20" height="2.33333" fill="black"/>
    <path d="M2 9.33331H13M2 11.6666H8" stroke="black" strokeLinecap="round"/>
  </svg>
);

const IcoFaceGraphic = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="9" cy="9" r="9" fill="#D9D9D9"/>
    <path d="M8.79999 4.5L6.7611 10.372C6.5355 11.0217 7.01797 11.7 7.70578 11.7H10.8" stroke="black" strokeLinecap="round"/>
    <circle cx="4.49998" cy="7.2" r="0.9" fill="black"/>
    <circle cx="13.5" cy="7.2" r="0.9" fill="black"/>
  </svg>
);

const IcoPersonGraphic = () => (
  <svg width="14" height="18" viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M6.99994 11.385C10.2365 11.3765 12.9885 12.9143 14 16.2248C11.9611 17.511 9.56112 18.0064 6.99994 17.9999C4.43876 18.0064 2.03887 17.511 0 16.2248C1.0127 12.9107 3.75994 11.3765 6.99994 11.385Z" fill="#D9D9D9"/>
    <path d="M11.3929 4.54597C11.3929 7.05663 9.42614 9.09194 7.00006 9.09194C4.57398 9.09194 2.60731 7.05663 2.60731 4.54597C2.60731 2.0353 4.57398 0 7.00006 0C9.42614 0 11.3929 2.0353 11.3929 4.54597Z" fill="#D9D9D9"/>
  </svg>
);

const IcoCameraBtn = () => (
  <svg width="22" height="14" viewBox="0 0 22 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 0C15.1046 0 16 0.895431 16 2V4.1123L21.5 0.9375V13.0625L16 9.88672V12C16 13.1046 15.1046 14 14 14H2C0.895431 14 4.832e-08 13.1046 0 12V2C0 0.895431 0.895431 0 2 0H14Z" fill="#121724"/>
    <circle cx="12" cy="3" r="1" fill="#00B8FF"/>
  </svg>
);

const IcoDone = () => (
  <svg width="86" height="86" viewBox="0 0 86 86" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M39.5924 5.54343C41.1539 3.00308 44.8461 3.00308 46.4076 5.54343L49.0419 9.82867C50.1539 11.6377 52.4857 12.2625 54.3533 11.2519L58.7772 8.85783C61.3997 7.43863 64.5972 9.28468 64.6794 12.2655L64.8181 17.2937C64.8766 19.4164 66.5836 21.1234 68.7063 21.1819L73.7345 21.3206C76.7153 21.4028 78.5614 24.6003 77.1422 27.2228L74.7481 31.6467C73.7375 33.5143 74.3623 35.8461 76.1713 36.9581L80.4566 39.5924C82.9969 41.1539 82.9969 44.8461 80.4566 46.4076L76.1713 49.0419C74.3623 50.1539 73.7375 52.4857 74.7481 54.3532L77.1422 58.7772C78.5614 61.3997 76.7153 64.5972 73.7345 64.6794L68.7063 64.8181C66.5836 64.8766 64.8766 66.5836 64.8181 68.7063L64.6794 73.7345C64.5972 76.7153 61.3997 78.5614 58.7772 77.1422L54.3533 74.7481C52.4857 73.7375 50.1539 74.3623 49.0419 76.1713L46.4076 80.4566C44.8461 82.9969 41.1539 82.9969 39.5924 80.4566L36.9581 76.1713C35.8461 74.3623 33.5143 73.7375 31.6468 74.7481L27.2228 77.1422C24.6003 78.5614 21.4028 76.7153 21.3206 73.7345L21.1819 68.7063C21.1234 66.5836 19.4164 64.8766 17.2937 64.8181L12.2655 64.6794C9.28468 64.5972 7.43863 61.3997 8.85783 58.7772L11.2519 54.3533C12.2625 52.4857 11.6377 50.1539 9.82867 49.0419L5.54343 46.4076C3.00308 44.8461 3.00308 41.1539 5.54343 39.5924L9.82867 36.9581C11.6377 35.8461 12.2625 33.5143 11.2519 31.6467L8.85783 27.2228C7.43863 24.6003 9.28468 21.4028 12.2655 21.3206L17.2937 21.1819C19.4164 21.1234 21.1234 19.4164 21.1819 17.2937L21.3206 12.2655C21.4028 9.28468 24.6003 7.43863 27.2228 8.85783L31.6467 11.2519C33.5143 12.2625 35.8461 11.6377 36.9581 9.82867L39.5924 5.54343Z" fill="#00B8FF"/>
    <circle cx="43" cy="43" r="25" fill="#16334C"/>
    <path d="M32 46L40.5 54.5L53.4904 32" stroke="#00B8FF" strokeWidth="5" strokeLinecap="round"/>
  </svg>
);

const IcoResultHeader = () => (
  <svg width="210" height="58" viewBox="0 0 210 58" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g clipPath="url(#rh_outer)">
      <g clipPath="url(#rh_inner)">
        <path d="M29.64 30.0131C29.64 36.6231 24 41.9731 17.09 41.9731C10.18 41.9731 4.59003 36.6231 4.59003 30.0131C4.59003 23.4031 10.19 17.9531 17.09 17.9531C23.99 17.9531 29.64 23.3531 29.64 30.0131ZM20.7 28.9731C19.95 26.2131 17.73 24.4131 15.75 24.9531C13.77 25.5031 12.78 28.1731 13.53 30.9331C14.29 33.6931 16.5 35.4931 18.48 34.9531C20.46 34.4131 21.45 31.7431 20.7 28.9731Z" fill="white"/>
        <path d="M58.56 29.6231C58.56 36.5331 53.74 42.0231 47.23 42.0231C45.08 42.0231 42.88 41.8331 41.29 40.6831C41.25 40.6531 41.21 40.6831 41.21 40.7231V48.4931C41.21 51.1831 39.03 53.3631 36.35 53.3631H32.08C32.08 53.3631 32.02 53.3431 32.02 53.3031C32.11 51.9331 32.16 49.7431 32.16 48.4931V23.4931C32.16 23.4931 32.14 23.4331 32.1 23.4331H29.72C29.72 23.4331 29.65 23.3931 29.66 23.3531C30.24 22.0431 31.03 19.8931 31.42 18.4631C31.42 18.4431 31.45 18.4231 31.48 18.4231H41.16C41.16 18.4231 41.22 18.4431 41.22 18.4831V20.5431C41.22 20.5931 41.28 20.6231 41.31 20.5831C43.18 18.8931 45.06 17.9531 47.83 17.9531C54.1 17.9531 58.58 23.3031 58.58 29.6331L58.56 29.6231ZM49.32 30.0131C49.32 27.5331 47.52 25.4931 45.33 25.4931C42.99 25.4931 41 27.5331 41 30.0131C41 32.4931 42.95 34.5431 45.28 34.5431C47.47 34.5431 49.32 32.5431 49.32 30.0131Z" fill="white"/>
        <path d="M71.86 25.8669V30.5369C71.86 33.4569 73.12 34.5769 75.02 34.5769C75.7 34.5769 76.87 34.4269 77.21 34.0869V37.1369C77.21 39.7969 75.07 42.0169 72.41 42.0169H72.34C67.28 42.0169 62.86 38.9969 62.86 32.3869V25.8669H59.75V18.4269H62.86V16.4769C62.86 14.9169 62.81 13.2169 62.71 12.0469H72C71.9 13.2169 71.85 14.8669 71.85 16.4769V18.4269H77.88V19.8369C77.88 23.1669 75.18 25.8669 71.85 25.8669H71.86Z" fill="white"/>
        <path d="M90.24 36.7663V36.8263C90.24 39.4763 88.11 41.6362 85.46 41.6362H81C81.1 40.6162 81.2 38.4263 81.2 36.7663V23.5363H78.66C79.29 22.3763 80.12 19.9863 80.46 18.4363H90.43C90.48 20.1063 90.24 36.7663 90.24 36.7663ZM80.9 11.3263C80.9 8.59625 83.04 6.40625 85.72 6.40625C88.4 6.40625 90.49 8.59625 90.49 11.3263C90.49 14.0563 88.4 16.1863 85.72 16.1863C83.04 16.1863 80.9 13.9963 80.9 11.3263Z" fill="white"/>
        <path d="M110.09 32.0031V41.4031C110.09 41.4531 110.05 41.4931 110 41.5031C108.41 41.6531 107.66 41.9831 105.18 41.9831C97.4 41.9831 92.14 36.6331 92.14 30.0631C92.14 23.4931 97.44 17.9531 105.18 17.9531C106.88 17.9531 108.68 18.4431 109.9 18.4831V27.8231C108.88 26.7031 107.71 25.7331 105.38 25.7331C102.9 25.7331 100.95 27.6831 100.95 30.0631C100.95 32.4431 102.9 34.2931 105.38 34.2931C107.76 34.2931 109.18 33.1331 110.1 32.0131L110.09 32.0031Z" fill="white"/>
        <path d="M135.66 35.1631V36.6031C135.66 39.6831 133.14 42.2031 130.06 42.2131C127.44 42.2131 126.12 41.2431 125.15 39.8331C123.74 41.3931 121.99 42.2231 119.6 42.2231C115.17 42.2231 112.21 39.3531 112.21 35.0231C112.21 30.6931 115.08 27.5331 119.94 27.5331C121.84 27.5331 123.59 28.0231 124.27 28.4531V27.5331C124.27 25.4931 122.71 24.4231 120.14 24.4231C117.57 24.4231 115.57 25.3931 114.2 26.7031V19.6531C116.24 18.6331 117.94 17.9531 122.76 17.9531C129.91 17.9531 133.07 22.1831 133.07 28.5631V33.6231C133.07 34.9831 133.66 35.4131 134.33 35.4131C134.77 35.4131 135.3 35.3631 135.65 35.1631H135.66ZM122.62 33.0231C121.6 33.0231 120.77 33.8031 120.77 34.7231C120.77 35.7731 121.65 36.5631 122.7 36.5231C123.32 36.4931 123.89 36.1331 124.21 35.6031C124.95 34.3531 123.95 33.0231 122.62 33.0231Z" fill="white"/>
        <path d="M153.83 18.1375V27.5775C153.05 27.0375 151.88 26.4575 150.47 26.4575C147.65 26.4575 146.68 29.6675 146.68 31.6675V36.8175C146.68 39.4775 144.56 41.6375 141.9 41.6375H137.43C137.53 40.0375 137.58 38.3775 137.58 36.7675V23.4875H135.05C135.68 22.0775 136.51 19.8875 136.85 18.4275H145.7V23.4375C146.58 20.2275 148.91 17.9375 152.07 17.9375C153.38 17.9375 153.28 18.1275 153.82 18.1275L153.83 18.1375Z" fill="white"/>
        <path d="M182.67 41.6297H171.58C171.05 40.7097 169.88 39.1997 164.67 32.3397V36.7697C164.67 39.4597 162.49 41.6397 159.81 41.6397H155.43C155.58 40.5697 155.63 38.3797 155.63 36.7697V10.9897H153.1C153.63 9.72969 154.51 7.28969 154.85 5.92969H164.87C164.87 9.85969 164.67 27.5797 164.67 27.5797C168.3 22.0297 169.6 19.9597 170.41 18.4397H179.65C178.19 20.2897 177.31 21.5497 172.5 28.7997C179.16 37.7497 180.28 38.9597 182.66 41.6397L182.67 41.6297Z" fill="white"/>
        <path d="M204.44 35.1631V36.6031C204.44 39.6831 201.92 42.2031 198.85 42.2131C196.23 42.2131 194.91 41.2431 193.94 39.8331C192.53 41.3931 190.78 42.2231 188.39 42.2231C183.96 42.2231 181 39.3531 181 35.0231C181 30.6931 183.87 27.5331 188.74 27.5331C190.64 27.5331 192.39 28.0231 193.07 28.4531V27.5331C193.07 25.4931 191.51 24.4231 188.94 24.4231C186.37 24.4231 184.37 25.3931 183 26.7031V19.6531C185.04 18.6331 186.75 17.9531 191.56 17.9531C198.71 17.9531 201.87 22.1831 201.87 28.5631V33.6231C201.87 34.9831 202.46 35.4131 203.13 35.4131C203.57 35.4131 204.1 35.3631 204.45 35.1631H204.44ZM191.4 33.0231C190.38 33.0231 189.55 33.8031 189.55 34.7231C189.55 35.7731 190.43 36.5631 191.48 36.5231C192.1 36.4931 192.67 36.1331 192.99 35.6031C193.73 34.3531 192.73 33.0231 191.4 33.0231Z" fill="white"/>
        <path d="M105.09 6.53906H111.7L104.31 15.4891H102.41L94.8199 6.53906H101.78L103.43 8.97906L105.09 6.53906Z" fill="white"/>
      </g>
    </g>
    <defs>
      <clipPath id="rh_outer"><rect width="209.03" height="57.29" fill="white"/></clipPath>
      <clipPath id="rh_inner"><rect width="390" height="93.29" fill="white" transform="translate(-90.485 -36)"/></clipPath>
    </defs>
  </svg>
);

// ── Constants ─────────────────────────────────────────────────────────────
const LEFT_IRIS   = 468;
const RIGHT_IRIS  = 473;
const HISTORY_SIZE    = 25;
const STILL_THRESHOLD = 4;
const COUNTDOWN_MS    = 3000;
const BURST_FRAMES    = 3;     // rafal pri snimku: kartica se detektuje na svakom, uzima se medijana
const CARD_CHECK_MS   = 500;   // provera kartice uživo (2× u sekundi, na slici pola rezolucije)
const CARD_WAIT_MS    = 6000;  // najduže čekanje na dobro postavljenu karticu, pa se snima i bez nje
const IS_MOBILE = typeof navigator !== 'undefined'
  && (navigator.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));
const vfovFor = (frameW, frameH) =>
  parseVfovOverride(window.location.search) ?? vfovPrior({ mobile: IS_MOBILE, frameW, frameH });

// Očekivani položaj kartice (za obris na ekranu): na čelu, iznad obrva
function drawCardGuide(ctx, l, r, ok) {
  const [p0, p1] = l.x <= r.x ? [l, r] : [r, l];
  const ipd = Math.hypot(p1.x - p0.x, p1.y - p0.y); if (!(ipd > 0)) return;
  const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
  const w = ipd * 85.6 / 63, h = w * 53.98 / 85.6, up = 0.75 * ipd;
  const cx = (p0.x + p1.x) / 2 + Math.sin(ang) * up, cy = (p0.y + p1.y) / 2 - Math.cos(ang) * up;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
  ctx.strokeStyle = ok ? '#4ade80' : 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3;
  ctx.setLineDash(ok ? [] : [10, 8]);
  const rr = w * 0.037;
  ctx.beginPath();
  ctx.moveTo(-w / 2 + rr, -h / 2); ctx.lineTo(w / 2 - rr, -h / 2); ctx.arcTo(w / 2, -h / 2, w / 2, -h / 2 + rr, rr);
  ctx.lineTo(w / 2, h / 2 - rr); ctx.arcTo(w / 2, h / 2, w / 2 - rr, h / 2, rr);
  ctx.lineTo(-w / 2 + rr, h / 2); ctx.arcTo(-w / 2, h / 2, -w / 2, h / 2 - rr, rr);
  ctx.lineTo(-w / 2, -h / 2 + rr); ctx.arcTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2, rr);
  ctx.stroke(); ctx.restore();
}

// Frejm kamere u punoj rezoluciji, ogledalski okrenut (kao što ga korisnik vidi)
function grabMirrored(video) {
  const c = document.createElement('canvas');
  c.width = video.videoWidth; c.height = video.videoHeight;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.save(); g.scale(-1, 1); g.translate(-c.width, 0); g.drawImage(video, 0, 0); g.restore();
  return c;
}

function stddev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
}

// ── Shared CSS ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; border: 0; }
  html { height: 100%; font-size: 16px; }
  body { min-height: 100%; font-family: 'Inter', sans-serif; overflow: auto; }
  img, svg, video, canvas, object { display: block; vertical-align: middle; }
  button { font-family: inherit; font-size: 100%; font-weight: inherit; line-height: inherit; color: inherit; cursor: pointer; background: transparent; }

  .btn-primary {
    display: flex; align-items: center; justify-content: center; gap: 16px;
    width: 100%; background: #00b8ff; color: #111;
    font-size: 16px; font-weight: 600; line-height: 1.5;
    padding: 16px 10px; border-radius: 50px;
    touch-action: manipulation; transition: filter 0.15s;
  }
  .btn-primary:hover { filter: brightness(1.15); }
  .btn-primary:active { filter: brightness(0.9); }
  .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-secondary {
    display: flex; align-items: center; justify-content: center;
    width: 100%; background: transparent; color: #fff;
    font-size: 16px; font-weight: 500; line-height: 1.5;
    padding: 15px 23px; border-radius: 100px; border: 2px solid #4d4d4d;
    touch-action: manipulation; transition: filter 0.15s;
  }
  .btn-secondary:hover { filter: brightness(1.2); }

  .loading-spinner {
    width: 44px; height: 44px;
    border: 3px solid rgba(255,255,255,0.1); border-top-color: #00b8ff;
    border-radius: 50%; animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  video { width: 100%; height: 100%; object-fit: cover; display: block; transform: scaleX(-1); }
  canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

  button:focus-visible, select:focus-visible, input:focus-visible { outline: 2px solid #00b8ff; outline-offset: 2px; }

  .pd-adjust-hint { position: absolute; top: 22%; left: 50%; transform: translateX(-50%); text-align: center; max-width: 84%; color: #fff; pointer-events: none; opacity: 0.85; text-shadow: 0 2px 8px rgba(0,0,0,0.7), 0 0 16px rgba(0,0,0,0.4); z-index: 6; transition: opacity 0.4s ease-out, visibility 0s linear 0.4s; }
  .pd-adjust-hint.is-hidden { opacity: 0; visibility: hidden; }
  .pd-adjust-hint__big { font-size: 28px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; }
  .pd-adjust-hint__small { margin-top: 6px; font-size: 16px; font-weight: 500; line-height: 1.3; letter-spacing: -0.005em; }
  @media (min-width: 480px) {
    .pd-adjust-hint__big { font-size: 32px; }
    .pd-adjust-hint__small { font-size: 18px; }
  }
  @media (min-width: 1024px) {
    .pd-adjust-hint__big { font-size: 36px; }
    .pd-adjust-hint__small { font-size: 19px; }
  }
`;

const MAX_W = 420;

// ── Shared header component ───────────────────────────────────────────────
const Header = ({ onA11y }) => (
  <div style={{ background: '#121724', flexShrink: 0 }}>
    <header style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '19px 15px 13px 15px',
      maxWidth: MAX_W, margin: '0 auto', width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
        <IcoHeaderLogo />
        <div style={{ marginTop: 3, display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: '#fff', fontSize: 15, fontWeight: 600, marginLeft: -1, marginTop: -3 }}>PD Kalkulator</span>
          <span style={{ color: '#8c8c8c', fontSize: 11, fontWeight: 400, marginLeft: -1 }}>Optičarka.com</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button" onClick={onA11y} aria-label="Pristupačnost" title="Pristupačnost" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36,
          borderRadius: '50%', color: '#fff', border: '1px solid #404d66',
        }}>
          <IcoAccessibility size={22} />
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: '#00b8ff', color: '#111', fontSize: 12, fontWeight: 600,
          padding: '8px 16px', borderRadius: 100,
        }}>
          <IcoAiBadge />
          <span>AI Powered</span>
        </div>
      </div>
    </header>
  </div>
);

// ── Blue icon cell (used in checklist) ────────────────────────────────────
const BlueCell = ({ children, style }) => (
  <div style={{
    width: 32, height: 24, background: '#16334c', borderRadius: 3,
    position: 'relative', flexShrink: 0, ...style,
  }}>
    {children}
  </div>
);

// ── Debug (?debug=1) ──────────────────────────────────────────────────────
const DBG_BOX = {
  fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 11, lineHeight: 1.45,
  color: '#9fe870', background: 'rgba(0,0,0,0.78)', borderRadius: 8, padding: '8px 10px',
};
const fmt = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : '–');

const DebugOverlay = ({ live, camera, delegate, phantom }) => (
  <div style={{ ...DBG_BOX, position: 'absolute', top: 8, left: 8, zIndex: 15, pointerEvents: 'none', whiteSpace: 'pre' }}>
    {`DEBUG${phantom ? ' · FANTOM' : ''} · ${delegate ?? '?'}
cam ${camera?.width ?? '?'}×${camera?.height ?? '?'} @${fmt(camera?.frameRate, 0)}
frame ${live ? `${live.w}×${live.h}` : '–'} · ${fmt(live?.fps, 0)} fps
IPD ${fmt(live?.ipdPx)} px (${fmt(live?.ipdPct)}% š.)
d(MP) ${fmt(live?.dMm, 0)} mm · proc. ${fmt(live?.dEst, 0)} mm
kartica ${live?.card ?? '–'}
yaw ${fmt(live?.yaw)}° pitch ${fmt(live?.pitch)}°
svetlo ${fmt(live?.luma, 0)} · oštrina ${fmt(live?.sharp, 0)}
status ${live?.status ?? '–'}`}
  </div>
);

const DebugPanel = ({ report, phantom, onImage, onImageRaw }) => {
  const [msg, setMsg] = useState('');
  if (!report) {
    return (
      <div style={{ ...DBG_BOX, margin: '0 16px 24px', alignSelf: 'center', maxWidth: MAX_W - 32 }}>
        DEBUG{phantom ? ' · FANTOM (bez konvergencije)' : ''} — izveštaj se pravi klikom na „Izračunaj PD".
      </div>
    );
  }
  const m = report.measurement, c = report.capture, cam = report.camera;
  const json = JSON.stringify(report, null, 2);
  const rows = [
    ['kamera', `${cam.width ?? '?'}×${cam.height ?? '?'} ${cam.delegate ?? ''}`],
    ['isečak', c.crop ? `${c.crop.w}×${c.crop.h}${report.env?.zoomed ? ' · uvećano' : ''}` : '–'],
    ['kartica', `${fmt(m.cardSrcPx)} px · ${fmt(m.mmPerPx, 3)} mm/px`],
    ['zenice', `${fmt(m.pupilSrcPx)} px · pomereno ${fmt(m.pupilPrefillShiftPx)} px`],
    ['pozicija', m.cardPosition],
    ['udaljenost', `${m.distanceUsedMm ?? '–'} mm (${m.distanceSource}${m.distanceSanitized ? ', default' : ''})`],
    ['d kartica/MP', `${m.distanceCardMm ?? '–'} / ${m.distanceMpMm ?? '–'} mm · FOV ${m.vfovDeg ?? '–'}°`],
    ['auto kartica', m.cardDetect ? `${m.cardDetect.used ? 'DA' : 'ne'} · ${m.cardDetect.widthPx ?? '–'} px · pouzd. ${m.cardDetect.confidence ?? '–'}${m.cardMarkersMovedPx != null ? ` · pomereno ${m.cardMarkersMovedPx} px` : ''}` : '–'],
    ['poza', `yaw ${c.yawDeg ?? '–'}° pitch ${c.pitchDeg ?? '–'}° · jitter ${c.pupilJitterPx ?? '–'} px`],
    ['svetlo/oštrina', `${c.luma ?? '–'} / ${c.sharpness ?? '–'}`],
    ['PD sirovi', `${fmt(m.rawPdMm, 2)} mm`],
    ['× paralaksa', fmt(m.parallaxFactor, 4)],
    ['× konvergencija', fmt(m.vergenceFactor, 4)],
    ['PD korig.', `${fmt(m.correctedPdMm, 2)} → ${m.finalPdMm ?? 'van opsega'}`],
    ['šarenica', m.irisDiameterMm.map(v => `${fmt(v)} mm`).join(' / ')],
  ];
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `pd-debug-${report.timestamp.replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(json); setMsg('Kopirano'); } catch { setMsg('Kopiranje nije uspelo'); }
  };
  return (
    <div style={{ ...DBG_BOX, margin: '0 16px 24px', alignSelf: 'center', width: 'calc(100% - 32px)', maxWidth: MAX_W - 32 }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>DEBUG{report.mode === 'fantom' ? ' · FANTOM' : ''}</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#8c8c8c', minWidth: 110 }}>{k}</span><span>{v}</span>
        </div>
      ))}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' }}>
        <button onClick={download} style={{ border: '1px solid #9fe870', borderRadius: 6, padding: '4px 10px' }}>Preuzmi JSON</button>
        <button onClick={copy} style={{ border: '1px solid #9fe870', borderRadius: 6, padding: '4px 10px' }}>Kopiraj JSON</button>
        {onImage && <button onClick={onImage} style={{ border: '1px solid #9fe870', borderRadius: 6, padding: '4px 10px' }}>Preuzmi snimak</button>}
        {onImageRaw && <button onClick={onImageRaw} style={{ border: '1px solid #9fe870', borderRadius: 6, padding: '4px 10px' }}>Snimak bez oznaka</button>}
        <span>{msg}</span>
      </div>
    </div>
  );
};

// ── PDMeasurement ─────────────────────────────────────────────────────────
const PDMeasurement = () => {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const roiCanvasRef = useRef(null); // mali canvas za merenje svetla/oštrine

  const [step, setStep]                   = useState('intro');
  const [cameraReady, setCameraReady]     = useState(false);
  const [faceMesh, setFaceMesh]           = useState(null);
  const [loading, setLoading]             = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError]                 = useState(null);
  const [finalPD, setFinalPD]             = useState(null);
  const [faceDetected, setFaceDetected]   = useState(false);
  const [faceStatus, setFaceStatus]       = useState('none');
  const [countdown, setCountdown]         = useState(null);
  const [snapshotUrl, setSnapshotUrl]     = useState(null);
  const [showManualCopy, setShowManualCopy] = useState(false);
  const [copyOk, setCopyOk]               = useState(false);
  const [sentToParent, setSentToParent]   = useState(false); // ?embed=vizor — poslato u konfigurator
  const [eyeVariant, setEyeVariant]       = useState('open');
  const [showAdjustHint, setShowAdjustHint] = useState(true);

  // Markeri u pikselima izvornog snimka (snapSize)
  const [snapSize, setSnapSize]         = useState({ w: 0, h: 0 });
  const [cardMarkers, setCardMarkers]   = useState([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  const [pupilMarkers, setPupilMarkers] = useState([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  const [zoomed, setZoomed]             = useState(true);

  // ── Pristupačnost: podešavanja, titl, glas ──
  const [settings, setSettingsState] = useState(() => loadSettings());
  const [a11yOpen, setA11yOpen]      = useState(false);
  const [caption, setCaption]        = useState(null);
  const voiceRef = useRef(null);
  if (!voiceRef.current) {
    voiceRef.current = createVoice({ baseUrl: `${import.meta.env.BASE_URL}audio/`, onCaption: setCaption });
  }
  const voice = voiceRef.current;
  const setSettings = (next) => { setSettingsState(next); saveSettings(next); };
  useEffect(() => { voice.setEnabled(settings.voice); }, [settings.voice, voice]);
  const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
  const buzz = (pattern) => { if (settings.vibration) vibrate(pattern); };
  const play = (name, arg) => { if (settings.sounds) sfx[name](arg); };

  const animationRef   = useRef(null);
  const lastTimeRef    = useRef(-1);
  const faceHistoryRef = useRef([]);
  const cntdwnStartRef = useRef(null);
  const lumaRef        = useRef({ luma: NaN, sharp: NaN, n: 0 });
  const cardLiveRef    = useRef({ t: 0, status: 'missing', goodSince: null, log: [] }); // provera kartice uživo
  const halfCanvasRef  = useRef(null);
  const burstRef       = useRef(null);  // { frames, prefill, ... } dok traje rafal pri snimku
  const captureDistanceRef = useRef(null); // udaljenost po MediaPipe-u (mm) — samo rezerva i debug
  const captureFrameRef    = useRef(null); // { vW, vH } frejma kamere pri snimku (za FOV → udaljenost iz kartice)
  const cardDetectRef      = useRef(null); // rezultat automatske detekcije kartice (B1)
  const [cardAuto, setCardAuto] = useState(false);

  // ── Debug režim (?debug=1, &fantom=1) — bez uticaja na ponašanje kad je isključen
  const { debug, phantom } = useRef(parseDebugFlags(window.location.search)).current;
  const delegateRef     = useRef(null);
  const cameraInfoRef   = useRef({});
  const captureMetaRef  = useRef(null);
  const prefillPupilsRef = useRef(null);
  const dbgTickRef      = useRef({ frames: 0, since: 0 });
  const [liveDbg, setLiveDbg] = useState(null);
  const [report, setReport]   = useState(null);

  const urlParams = useRef((() => {
    const p = new URLSearchParams(window.location.search);
    return { source: p.get('source'), returnUrl: p.get('return'), embed: p.get('embed') };
  })());
  const { source, returnUrl, embed } = urlParams.current;
  // Vizor konfigurator ugrađuje kalkulator u iframe (?embed=vizor) i sluša rezultat.
  const inIframe = typeof window !== 'undefined' && window.parent && window.parent !== window;

  // ── Eye blink ──────────────────────────────────────────────────────────
  useEffect(() => {
    let closeT;
    const blink = () => {
      setEyeVariant('closed');
      closeT = setTimeout(() => setEyeVariant('open'), 180);
    };
    const t1 = setTimeout(blink, 1500);
    const iv = setInterval(blink, 3500);
    return () => { clearInterval(iv); clearTimeout(t1); clearTimeout(closeT); };
  }, []);

  // ── MediaPipe ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const tryLoad = async (delegate) => {
        const mp = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs');
        const vision = await mp.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
        );
        return mp.FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate,
          },
          runningMode: 'VIDEO', numFaces: 1,
          outputFaceBlendshapes: false, outputFacialTransformationMatrixes: true,
        });
      };
      try {
        setLoadingStatus('Učitavanje MediaPipe biblioteke...');
        const fl = await tryLoad('GPU');
        delegateRef.current = 'GPU';
        if (!cancelled) { setFaceMesh(fl); setLoading(false); setLoadingStatus(''); }
      } catch (err) {
        try {
          setLoadingStatus('Pokušavam CPU režim...');
          const fl = await tryLoad('CPU');
          delegateRef.current = 'CPU';
          if (!cancelled) { setFaceMesh(fl); setLoading(false); setLoadingStatus(''); }
        } catch {
          if (!cancelled) { setError(`Greška pri učitavanju. Osvežite stranicu ili koristite Chrome.`); setLoading(false); }
        }
      }
    })();
    return () => { cancelled = true; cancelAnimationFrame(animationRef.current); };
  }, []);

  // ── Camera ─────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Veća rezolucija (portret 3:4): detekcija radi na umanjenoj slici, snimak u punoj
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } },
        audio: false,
      });
      if (!videoRef.current) return;
      if (debug) {
        const track = stream.getVideoTracks()[0];
        const st = track?.getSettings?.() ?? {};
        // bez deviceId/groupId — identifikatori uređaja ne ulaze u izveštaj
        cameraInfoRef.current = {
          label: track?.label ?? '', width: st.width, height: st.height, frameRate: st.frameRate,
          facingMode: st.facingMode, resizeMode: st.resizeMode,
        };
      }
      videoRef.current.srcObject = stream;
      await new Promise(r => { videoRef.current.onloadedmetadata = () => videoRef.current.play().then(r).catch(r); });
      await new Promise(r => setTimeout(r, 300));
      setCameraReady(true);
    } catch (err) {
      if (err.name === 'NotAllowedError') setError('Pristup kameri odbijen. Dozvolite pristup u podešavanjima pretraživača.');
      else if (err.name === 'NotFoundError') setError('Kamera nije pronađena.');
      else setError(`Greška kamere: ${err.message}`);
    }
  };

  // ── Detection loop ─────────────────────────────────────────────────────
  const detectFace = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!faceMesh || !video || !canvas) { animationRef.current = requestAnimationFrame(detectFace); return; }
    if (video.readyState !== 4 || video.currentTime === lastTimeRef.current) { animationRef.current = requestAnimationFrame(detectFace); return; }
    lastTimeRef.current = video.currentTime;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    }
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Rafal pri snimku: sledeći frejmovi se samo hvataju, bez detekcije lica
    if (burstRef.current) {
      burstRef.current.frames.push(grabMirrored(video));
      if (burstRef.current.frames.length >= BURST_FRAMES) { finalizeCapture(video); return; }
      animationRef.current = requestAnimationFrame(detectFace); return;
    }

    ctx.save(); ctx.scale(-1, 1); ctx.translate(-canvas.width, 0);

    try {
      const results = faceMesh.detectForVideo(video, performance.now());
      if (!results.faceLandmarks?.length) {
        setFaceDetected(false); setFaceStatus('none');
        faceHistoryRef.current = []; cntdwnStartRef.current = null; setCountdown(null);
        ctx.restore(); animationRef.current = requestAnimationFrame(detectFace); return;
      }
      setFaceDetected(true);
      const lm = results.faceLandmarks[0];
      const lIris = lm[LEFT_IRIS], rIris = lm[RIGHT_IRIS];
      const lX = lIris.x * canvas.width, lY = lIris.y * canvas.height;
      const rX = rIris.x * canvas.width, rY = rIris.y * canvas.height;
      const irisD = Math.abs(rX - lX);

      ctx.strokeStyle = '#00b8ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(lX, lY, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(rX, rY, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#00b8ff';
      ctx.beginPath(); ctx.arc(lX, lY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rX, rY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(lX, lY); ctx.lineTo(rX, rY); ctx.stroke();
      ctx.setLineDash([]);

      const matrixData = results.facialTransformationMatrixes?.[0]?.data;
      const pose = matrixData ? decomposeFacialMatrix(matrixData) : null;
      const poseOk = !pose || isPoseFrontal(pose);

      // Svetlo (i oštrina za debug) u oblasti očiju i čela — svakih 10 frejmova, na malom canvasu
      const lq = lumaRef.current;
      if (lq.n++ % 10 === 0) {
        const roi = eyeForeheadRoi({ x: lX, y: lY }, { x: rX, y: rY }, canvas.width, canvas.height);
        if (roi.w > 4 && roi.h > 4) {
          const rc = roiCanvasRef.current || (roiCanvasRef.current = document.createElement('canvas'));
          rc.width = 64; rc.height = 48;
          const rctx = rc.getContext('2d', { willReadFrequently: true });
          rctx.drawImage(video, roi.x, roi.y, roi.w, roi.h, 0, 0, 64, 48);
          const px = rctx.getImageData(0, 0, 64, 48).data;
          lq.luma = meanLuma(px);
          if (debug) lq.sharp = laplacianVariance(px, 64, 48);
        }
      }

      // Udaljenost u milimetrima (MediaPipe × korekcija po klasi uređaja), ne u pikselima kadra
      const dEst = Number.isFinite(pose?.distanceMm) ? estimateFaceDistance(pose.distanceMm, IS_MOBILE) : NaN;
      const dist = distanceStatusMm(dEst, irisD);
      const faceStatusNow = dist !== 'ok' ? dist : !poseOk ? 'pose' : lq.luma < MIN_LUMA ? 'dark' : 'good';

      // Kartica uživo: 2× u sekundi, na slici pola rezolucije — da li je na čelu iznad obrva i prislonjena
      const cl = cardLiveRef.current, now = performance.now();
      if (faceStatusNow === 'good') {
        if (!cl.goodSince) cl.goodSince = now;
        if (now - cl.t > CARD_CHECK_MS) {
          cl.t = now;
          try {
            const hw = canvas.width >> 1, hh = canvas.height >> 1;
            const hc = halfCanvasRef.current || (halfCanvasRef.current = document.createElement('canvas'));
            hc.width = hw; hc.height = hh;
            const hctx = hc.getContext('2d', { willReadFrequently: true });
            hctx.drawImage(video, 0, 0, hw, hh);
            const det = detectCardEdges({
              gray: toGray(hctx.getImageData(0, 0, hw, hh).data, hw, hh), width: hw, height: hh,
              pupils: [{ x: lX / 2, y: lY / 2 }, { x: rX / 2, y: rY / 2 }],
            });
            const full = det && { ...det, widthPx: det.widthPx * 2, markers: det.markers.map(m => ({ x: m.x * 2, y: m.y * 2 })) };
            const ev = evaluateCard({
              det: full, minConfidence: CARD_DETECT_MIN_CONFIDENCE, pupils: [{ x: lX, y: lY }, { x: rX, y: rY }],
              frameH: canvas.height, vfovDeg: vfovFor(canvas.width, canvas.height), dFaceMm: dEst,
            });
            cl.status = ev.status;
            if (debug) { cl.log.push({ status: ev.status, above: ev.above, ratio: ev.ratio, conf: det?.confidence }); if (cl.log.length > 40) cl.log.shift(); }
          } catch (e) { cl.status = 'missing'; }
        }
      } else cl.goodSince = null;
      // Snimak čeka dobro postavljenu karticu najviše CARD_WAIT_MS, pa se snima i bez nje (ručne oznake)
      const cardBlocks = faceStatusNow === 'good' && cl.status !== 'ok' && cl.goodSince && now - cl.goodSince < CARD_WAIT_MS;
      const status = cardBlocks ? `card-${cl.status}` : faceStatusNow;
      setFaceStatus(status);
      drawCardGuide(ctx, { x: lX, y: lY }, { x: rX, y: rY }, cl.status === 'ok');

      const hist = faceHistoryRef.current;
      hist.push({
        lX, lY, rX, rY, distanceMm: pose?.distanceMm ?? NaN,
        yawDeg: pose?.yawDeg ?? NaN, pitchDeg: pose?.pitchDeg ?? NaN,
        irisL: irisDiameterPx(lm, IRIS_H_EDGES.left, canvas.width, canvas.height),
        irisR: irisDiameterPx(lm, IRIS_H_EDGES.right, canvas.width, canvas.height),
      });
      if (hist.length > HISTORY_SIZE) hist.shift();
      const isStill = hist.length >= HISTORY_SIZE
        && stddev(hist.map(h => h.lX)) < STILL_THRESHOLD
        && stddev(hist.map(h => h.rX)) < STILL_THRESHOLD;

      if (debug) {
        const tick = dbgTickRef.current, now = performance.now();
        tick.frames++;
        if (now - tick.since > 250) {
          setLiveDbg({
            fps: tick.since ? tick.frames * 1000 / (now - tick.since) : 0,
            w: canvas.width, h: canvas.height, ipdPx: irisD, ipdPct: irisD / canvas.width * 100,
            yaw: pose?.yawDeg, pitch: pose?.pitchDeg, dMm: pose?.distanceMm, dEst, status, card: cl.status,
            luma: lq.luma, sharp: lq.sharp,
          });
          tick.frames = 0; tick.since = now;
        }
      }

      if (status === 'good' && isStill) {
        if (!cntdwnStartRef.current) cntdwnStartRef.current = Date.now();
        const elapsed = Date.now() - cntdwnStartRef.current;
        setCountdown(Math.max(0, Math.ceil((COUNTDOWN_MS - elapsed) / 1000)));

        if (elapsed >= COUNTDOWN_MS) {
          ctx.restore();
          // Median pozicija zenica kroz 25 frejmova mirovanja — manji jitter landmarka
          const mLX = median(hist.map(h => h.lX)), mLY = median(hist.map(h => h.lY));
          const mRX = median(hist.map(h => h.rX)), mRY = median(hist.map(h => h.rY));
          const dSamples = hist.map(h => h.distanceMm).filter(Number.isFinite);
          captureDistanceRef.current = dSamples.length ? median(dSamples) : null;
          const vW = video.videoWidth, vH = video.videoHeight;
          if (debug) {
            const fin = (k) => hist.map(h => h[k]).filter(Number.isFinite);
            captureMetaRef.current = {
              videoW: vW, videoH: vH,
              crop: { x: 0, y: 0, w: vW, h: vH },
              frames: hist.length,
              yawDeg: fin('yawDeg').length ? Number(median(fin('yawDeg')).toFixed(1)) : null,
              pitchDeg: fin('pitchDeg').length ? Number(median(fin('pitchDeg')).toFixed(1)) : null,
              pupilJitterPx: Number(Math.max(stddev(hist.map(h => h.lX)), stddev(hist.map(h => h.rX))).toFixed(2)),
              irisDiameterPx: [median(fin('irisL')), median(fin('irisR'))],
              luma: Number.isFinite(lq.luma) ? Math.round(lq.luma) : null,
              sharpness: Number.isFinite(lq.sharp) ? Math.round(lq.sharp) : null,
              cardLive: cardLiveRef.current.log.slice(-6),
            };
          }
          // Ceo kadar (bez isecanja na 3:4); zenice u px snimka (ogledalski), leva na ekranu prva
          const prefill = [{ x: vW - mLX, y: mLY }, { x: vW - mRX, y: mRY }].sort((p, q) => p.x - q.x);
          burstRef.current = { frames: [grabMirrored(video)], prefill, vW, vH };
          animationRef.current = requestAnimationFrame(detectFace); return;
        }
      } else { cntdwnStartRef.current = null; setCountdown(null); }
    } catch (e) { console.error('Detection error:', e); }
    ctx.restore(); animationRef.current = requestAnimationFrame(detectFace);
  }, [faceMesh, debug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kraj rafala: kartica se detektuje na svakom frejmu; medijana širine ako se frejmovi slažu (≤2%)
  function finalizeCapture(video) {
    const { frames, prefill, vW, vH } = burstRef.current;
    burstRef.current = null;
    const results = frames.map((c) => {
      try {
        const img = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
        return detectCardEdges({ gray: toGray(img.data, c.width, c.height), width: c.width, height: c.height, pupils: prefill });
      } catch { return null; }
    });
    const agg = aggregateBurst(results, CARD_DETECT_MIN_CONFIDENCE);
    const idx = agg ? agg.index : frames.length - 1;
    const det = results[idx];
    const autoOk = !!agg && agg.agree;
    setSnapshotUrl(frames[idx].toDataURL('image/jpeg', 0.92));
    // Kamera se gasi čim je slika uhvaćena (privatnost + baterija)
    video.srcObject?.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    setCameraReady(false);
    prefillPupilsRef.current = prefill;
    setSnapSize({ w: vW, h: vH });
    setPupilMarkers(prefill);
    captureFrameRef.current = { vW, vH };
    cardDetectRef.current = det ? { ...det, used: autoOk } : { used: false };
    if (debug && captureMetaRef.current) {
      captureMetaRef.current.burst = results.map(r => (r ? { w: Number(r.widthPx.toFixed(1)), conf: Number(r.confidence.toFixed(2)) } : null));
      captureMetaRef.current.burstSpread = agg ? Number((agg.spread * 100).toFixed(2)) : null;
    }
    setCardAuto(autoOk);
    setCardMarkers(autoOk ? det.markers : cardPrefill(prefill, vW, vH));
    setZoomed(true);
    setCountdown(null); setStep('adjust');
  }

  useEffect(() => {
    if (cameraReady && faceMesh && step === 'detecting') { lastTimeRef.current = -1; detectFace(); }
    return () => cancelAnimationFrame(animationRef.current);
  }, [cameraReady, faceMesh, step, detectFace]);

  // ── Cleanup na unmount: MediaPipe graf i kamera ────────────────────────
  useEffect(() => () => { faceMesh?.close?.(); }, [faceMesh]);
  useEffect(() => () => {
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
  }, []);

  // ── Adjust: instrukcija "Pomaknite crvene markere…" auto-dismiss 3s + 0.4s fade
  useEffect(() => {
    if (step !== 'adjust') return;
    setShowAdjustHint(true);
    const t = setTimeout(() => setShowAdjustHint(false), 3400);
    return () => clearTimeout(t);
  }, [step]);

  // ── Adjust: pomeranje markera (AdjustView radi u px snimka) ────────────
  const moveMarker = (group, index, pos) => {
    const setter = group === 'card' ? setCardMarkers : setPupilMarkers;
    setter(p => p.map((m, i) => (i === index ? pos : m)));
  };

  // ── PD calc ────────────────────────────────────────────────────────────
  const formatPd = (v) => v.toLocaleString('sr-RS', { maximumFractionDigits: 1 });

  const calculatePD = () => {
    // Sve u pikselima izvornog snimka — ne zavisi od veličine ekrana ni od zuma prikaza
    const m = rawPdFromMarkers(cardMarkers, pupilMarkers);
    if (!m) { setError('Postavite markere kartice dalje jedan od drugog.'); return; }
    const { cardPx, pupilPx, rawPdMm: rawPd } = m;
    const cardPosition = classifyCardPosition(
      (cardMarkers[0].y + cardMarkers[1].y) / 2 / snapSize.h * 100,
      (pupilMarkers[0].y + pupilMarkers[1].y) / 2 / snapSize.h * 100,
    );
    // B4: udaljenost iz poznate širine kartice (FOV po klasi uređaja); MediaPipe samo kao rezerva
    const frame = captureFrameRef.current;
    const vfovDeg = frame ? vfovFor(frame.vW, frame.vH) : NaN;
    const distanceCardMm = frame ? distanceFromCard({ cardPx, frameH: frame.vH, vfovDeg, cardPosition }) : NaN;
    const useCard = Number.isFinite(distanceCardMm);
    const distanceMm = useCard ? distanceCardMm : captureDistanceRef.current;
    const pd = computeCorrectedPd({
      rawPdMm: rawPd,
      distanceMm,
      cardPosition,
      includeVergence: !phantom,
    });
    const [min, max] = source === 'vto' ? [48, 80] : [40, 80.5];

    if (debug) {
      const pre = prefillPupilsRef.current;
      const shift = pre ? Math.max(...pupilMarkers.map((p, i) => distPx(p, pre[i]))) : NaN;
      setReport(buildReport({
        capture: captureMetaRef.current ?? {},
        camera: { ...cameraInfoRef.current, delegate: delegateRef.current },
        env: {
          userAgent: navigator.userAgent,
          screen: `${window.screen.width}x${window.screen.height}`,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
          dpr: window.devicePixelRatio, zoomed,
          source: source ?? null, embed: embed ?? null,
        },
        cardSrcPx: cardPx,
        pupilSrcPx: pupilPx,
        pupilPrefillShiftPx: shift,
        cardPosition,
        distanceMm,
        distanceMpMm: captureDistanceRef.current,
        distanceCardMm,
        distanceSource: useCard ? 'kartica' : 'mediapipe',
        vfovDeg,
        cardDetect: cardDetectRef.current,
        cardMarkersMovedPx: cardDetectRef.current?.used
          ? Math.max(...cardMarkers.map((m, i) => distPx(m, cardDetectRef.current.markers[i]))) : null,
        pdFinal: pd >= min && pd <= max ? pd : null,
        phantom,
      }));
    }

    if (pd < min || pd > max) {
      // Van opsega → korisnik ostaje na adjust koraku i popravlja markere. Bez tihog clamp-a.
      setError(`Vrednost (${formatPd(pd)} mm) je van opsega ${min}–${max} mm. Pomerite markere na ivice kartice i centre zenica, pa pokušajte ponovo.`);
      voice.say('G22', { interrupt: true }); play('error');
      return;
    }
    setError(null);
    voice.stop(); play('success'); buzz(60);
    setFinalPD(pd); setStep('result');
  };

  // ── Debug: snimak u punoj rezoluciji sa oznakama (preuzima se samo lokalno) ──
  const downloadAnnotated = (annotate = true) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      if (!annotate) return save(c, 'pd-snimak-cist');
      const lw = Math.max(1, c.width / 720);
      g.lineWidth = lw;
      g.strokeStyle = '#FF6B6B';
      cardMarkers.forEach((m, i) => {
        const h = 40 * lw, d = i === 0 ? 8 * lw : -8 * lw;
        g.beginPath();
        g.moveTo(m.x + d, m.y - h); g.lineTo(m.x, m.y - h); g.lineTo(m.x, m.y + h); g.lineTo(m.x + d, m.y + h);
        g.stroke();
      });
      g.strokeStyle = '#00b8ff';
      pupilMarkers.forEach(m => {
        g.beginPath(); g.arc(m.x, m.y, 10 * lw, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.moveTo(m.x - 3 * lw, m.y); g.lineTo(m.x + 3 * lw, m.y); g.moveTo(m.x, m.y - 3 * lw); g.lineTo(m.x, m.y + 3 * lw); g.stroke();
      });
      const r = report?.measurement;
      g.font = `${14 * lw}px monospace`; g.fillStyle = '#9fe870';
      g.fillText(`kartica ${r?.cardSrcPx ?? '-'} px | zenice ${r?.pupilSrcPx ?? '-'} px | PD sirovi ${r?.rawPdMm ?? '-'} → ${r?.finalPdMm ?? '-'} mm`, 8 * lw, c.height - 10 * lw);
      save(c, 'pd-snimak');
    };
    const save = (c, name) => c.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/jpeg', 0.95);
    img.src = snapshotUrl;
  };

  // ── Return value ───────────────────────────────────────────────────────
  const returnValue = async (pd) => {
    const pdForVto = Math.round(pd); // VTO dropdown radi u celim mm

    let clipboardOk = false;
    try { await navigator.clipboard?.writeText(String(pd)); clipboardOk = true; } catch {}

    // Ugrađen u Vizor (iframe): vrednost ide roditeljskoj stranici, sa 0,5 mm preciznošću
    // koju polje PD u konfiguratoru nudi. Tab se ne zatvara — iframe nema svoj prozor.
    if (inIframe && embed === 'vizor') {
      const pdHalf = Math.round(pd * 2) / 2;
      for (const origin of ALLOWED_ORIGINS) {
        try { window.parent.postMessage({ type: 'vizor:pd', pd: pdHalf }, origin); } catch {}
      }
      setSentToParent(true);
      return;
    }

    const openerAlive = window.opener && !window.opener.closed;
    if (openerAlive) {
      // targetOrigin ograničen na allowlist — poruka stiže samo Optičarkinim stranicama
      for (const origin of ALLOWED_ORIGINS) {
        try { window.opener.postMessage({ type: 'PD_RESULT', value: pdForVto }, origin); } catch {}
      }
      setTimeout(() => window.close(), 300); return;
    }
    const target = resolveReturnTarget(returnUrl); // bez decodeURIComponent — get() je već dekodirao
    if (source === 'vto' && target) {
      target.searchParams.set('pd', String(pdForVto));
      target.searchParams.set('reopenVTO', '1');
      window.location.href = target.toString(); return;
    }
    setCopyOk(clipboardOk);
    setShowManualCopy(true);
  };

  // ── Reset ──────────────────────────────────────────────────────────────
  const reset = () => {
    voice.stop();
    cancelAnimationFrame(animationRef.current);
    videoRef.current?.srcObject?.getTracks().forEach(t => t.stop());
    setStep('intro'); setCameraReady(false); setFaceDetected(false); setFaceStatus('none');
    setCountdown(null); setSnapshotUrl(null); setFinalPD(null); setShowManualCopy(false); setCopyOk(false);
    faceHistoryRef.current = []; cntdwnStartRef.current = null; lastTimeRef.current = -1;
    captureDistanceRef.current = null; captureFrameRef.current = null; cardDetectRef.current = null; setCardAuto(false);
    captureMetaRef.current = null; prefillPupilsRef.current = null; setReport(null); setLiveDbg(null);
    burstRef.current = null; cardLiveRef.current = { t: 0, status: 'missing', goodSince: null, log: [] };
  };
  const retryDetect = () => {
    faceHistoryRef.current = []; cntdwnStartRef.current = null; setCountdown(null); lastTimeRef.current = -1;
    captureDistanceRef.current = null; captureFrameRef.current = null; cardDetectRef.current = null; setCardAuto(false);
    captureMetaRef.current = null; prefillPupilsRef.current = null; setReport(null); setLiveDbg(null);
    burstRef.current = null; cardLiveRef.current = { t: 0, status: 'missing', goodSince: null, log: [] };
    voice.stop();
    setSnapshotUrl(null); setStep('detecting'); startCamera();
  };

  // ── Glasovno vođenje ───────────────────────────────────────────────────
  // Status detekcije se izgovara tek kad traje STATUS_HOLD_MS (bez „treperenja" poruka)
  useEffect(() => {
    if (step !== 'detecting' || !cameraReady || countdown !== null) return;
    const id = STATUS_PROMPT[faceDetected ? faceStatus : 'none'];
    if (!id) return;
    const t = setTimeout(() => voice.say(id), STATUS_HOLD_MS);
    return () => clearTimeout(t);
  }, [step, cameraReady, faceDetected, faceStatus, countdown, voice]);

  // Odbrojavanje: glas (G14 „Tri. Dva. Jedan. Snimljeno!") ili pisak; uvek i vibracija
  const prevCountdownRef = useRef(null);
  useEffect(() => {
    const prev = prevCountdownRef.current;
    prevCountdownRef.current = countdown;
    if (countdown === prev) return;
    if (countdown !== null && prev === null) {
      if (settings.countdown === 'voice' && settings.voice) voice.say('G14', { interrupt: true });
      else play('tick', countdown <= 1);
      buzz(40);
    } else if (countdown !== null) {
      if (!(settings.countdown === 'voice' && settings.voice)) play('tick', countdown <= 1);
      buzz(40);
    } else if (step === 'detecting' && voice.current === 'G14') {
      voice.stop(); // pokret je prekinuo odbrojavanje
    }
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  // Snimak napravljen → okidač (u režimu piska), pa uputstvo za proveru oznaka
  const prevStepRef = useRef(step);
  useEffect(() => {
    const prev = prevStepRef.current;
    prevStepRef.current = step;
    if (step === 'adjust' && prev === 'detecting') {
      if (!(settings.countdown === 'voice' && settings.voice)) play('shutter');
      buzz([80]);
      voice.enqueue(['G21']);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const a11yPanel = (
    <AccessibilityPanel open={a11yOpen} onClose={() => setA11yOpen(false)}
      settings={settings} onChange={setSettings} canVibrate={canVibrate} />
  );

  // ══════════════════════════════════════════════════════════════════════
  // ── ADJUST step ───────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (step === 'adjust' && snapshotUrl) {
    return (
      <div style={{ minHeight: '100vh', background: '#171f2e', fontFamily: 'Inter, sans-serif', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <style>{GLOBAL_CSS}</style>

        {/* Error banner (npr. vrednost van opsega) */}
        {error && (
          <div style={{ background: 'rgba(200,40,40,0.15)', borderBottom: '1px solid rgba(200,40,40,0.3)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
            <span style={{ color: '#ff8080', fontSize: 14 }}>{error}</span>
            <button onClick={() => setError(null)} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, padding: '0 4px' }}>✕</button>
          </div>
        )}

        <Header onA11y={() => setA11yOpen(true)} />

        {/* Legenda + uvećano/ceo snimak */}
        <div style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', padding: '8px 16px 6px', display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: '#8c8c8c', flexShrink: 0 }}>
          <span><span style={{ color: '#FF6B6B', fontWeight: 700 }}>[ ]</span> ivice kartice</span>
          <span><span style={{ color: '#00b8ff' }}>◎</span> zenice</span>
          <button type="button" onClick={() => setZoomed(z => !z)} style={{ marginLeft: 'auto', color: '#00b8ff', fontSize: 12, fontWeight: 600, padding: '4px 0' }}>
            {zoomed ? 'Ceo snimak' : 'Uvećaj'}
          </button>
        </div>

        {/* Fotografija — 3:4, širina ograničena i visinom ekrana */}
        <div style={{ width: '100%', maxWidth: `min(${MAX_W}px, calc((100vh - 340px) * 3 / 4))`, alignSelf: 'center', flexShrink: 0 }}>
          <AdjustView
            snapshotUrl={snapshotUrl}
            snapSize={snapSize}
            rect={zoomed ? zoomRect(prefillPupilsRef.current, snapSize.w, snapSize.h) : { x: 0, y: 0, w: snapSize.w, h: snapSize.h }}
            cardMarkers={cardMarkers}
            pupilMarkers={pupilMarkers}
            onMove={moveMarker}
            onInteract={() => setShowAdjustHint(false)}
            logoUrl={LOGO_URL}
            hint={
              <div className={`pd-adjust-hint${showAdjustHint ? '' : ' is-hidden'}`} aria-hidden="true">
                <div className="pd-adjust-hint__big">{cardAuto ? 'Proverite crvene oznake' : 'Pomaknite crvene markere'}</div>
                <div className="pd-adjust-hint__small">{cardAuto ? 'kartica je prepoznata automatski' : 'na levu i desnu ivicu kartice'}</div>
              </div>
            }
          />
        </div>

        <div style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center' }}>
          <Caption caption={caption} large={settings.largeText} />
        </div>

        {/* Buttons — same max-width */}
        <div style={{ maxWidth: MAX_W, width: '100%', alignSelf: 'center', padding: '12px 16px 28px', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button className="btn-secondary" onClick={retryDetect} style={{ flex: 1 }}>Ponovi</button>
          <button className="btn-primary" onClick={calculatePD} style={{ flex: 2 }}>Izračunaj PD</button>
        </div>
        {debug && <DebugPanel report={report} phantom={phantom} onImage={snapshotUrl ? () => downloadAnnotated(true) : null} onImageRaw={snapshotUrl ? () => downloadAnnotated(false) : null} />}
        {a11yPanel}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── INTRO, LOADING, DETECTING, RESULT ─────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: step === 'result' ? '#111' : '#171f2e', fontFamily: 'Inter, sans-serif', color: '#fff' }}>
      <style>{GLOBAL_CSS}</style>

      {/* Error banner */}
      {error && (
        <div style={{ background: 'rgba(200,40,40,0.15)', borderBottom: '1px solid rgba(200,40,40,0.3)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <span style={{ color: '#ff8080', fontSize: 14 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, padding: '0 4px' }}>✕</button>
        </div>
      )}

      <Header onA11y={() => setA11yOpen(true)} />

      {/* All screen content constrained to MAX_W */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: MAX_W, margin: '0 auto', alignSelf: 'center' }}>

      {/* ── LOADING ── */}
      {loading && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
          <div className="loading-spinner" />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Učitavanje AI modela</div>
            <div style={{ fontSize: 13, color: '#8c8c8c' }}>{loadingStatus || 'Molimo sačekajte...'}</div>
          </div>
        </div>
      )}

      {/* ── INTRO ── */}
      {step === 'intro' && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 48, paddingBottom: 48 }}>
          <div style={{ width: 'min(320px, calc(100% - 32px))', display: 'flex', flexDirection: 'column', gap: 48, paddingBottom: 8 }}>

            {/* Top: eye icon + title — 54px below header */}
            <div style={{ marginTop: 54, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
              <div style={{ width: 100, background: '#1f293d', padding: '9px 15px 10px 14px', border: '1px solid rgba(0,184,255,0.3)', borderRadius: 16 }}>
                <IcoEye variant={eyeVariant} size={69} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, alignSelf: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 26, fontWeight: 700, lineHeight: 1.385, letterSpacing: 0.51 }}>
                  <span style={{ color: '#fff' }}>Izmerite </span>
                  <span style={{ color: '#00b8ff' }}>PD</span>
                </div>
                <p style={{ color: '#8c8c8c', fontSize: 14, fontWeight: 400, lineHeight: 1.43, alignSelf: 'stretch', textAlign: 'center' }}>Pupilarna distanca za 30 sekundi</p>
              </div>
            </div>

            {/* Checklist card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 36, background: '#121724', padding: '31px 21px', border: '1px solid #404d66', borderRadius: 24 }}>
              <div style={{ margin: '0 3px', display: 'flex', flexDirection: 'column', gap: 24, color: '#fff', fontSize: 14, fontWeight: 500, lineHeight: 1.43 }}>

                {/* Row 1: kartica */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, alignSelf: 'stretch' }}>
                  <BlueCell>
                    <div style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)' }}>
                      <IcoCardGraphic />
                    </div>
                  </BlueCell>
                  <span>Kartica na čelu, iznad obrva. Skinite naočare i sočiva u boji.</span>
                </div>

                {/* Row 2: gledajte u kameru */}
                <div style={{ marginRight: 51, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, alignSelf: 'stretch' }}>
                  <BlueCell>
                    <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)' }}>
                      <IcoFaceGraphic />
                    </div>
                  </BlueCell>
                  <span>Gledajte TAČNO u kameru</span>
                </div>

                {/* Row 3: mirujte */}
                <div style={{ width: 165, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <BlueCell>
                    <div style={{ position: 'absolute', top: 3, left: '50%', transform: 'translateX(-50%)' }}>
                      <IcoPersonGraphic />
                    </div>
                  </BlueCell>
                  <span>Mirujte 3 sekunde</span>
                </div>

                {/* Row 4: označite ivice */}
                <div style={{ width: 189, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 32, background: '#16334c', padding: '3px 7px 4px 7px', borderRadius: 3, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ width: 7, height: 7, background: '#d9d9d9', borderRadius: '50%', alignSelf: 'center' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ width: 7, height: 7, background: '#d9d9d9', borderRadius: '50%' }} />
                      <div style={{ width: 7, height: 7, background: '#d9d9d9', borderRadius: '50%' }} />
                    </div>
                  </div>
                  <span>Označite ivice kartice</span>
                </div>
              </div>

              {/* Start button */}
              <button className="btn-primary" onClick={() => {
                // Klik otključava zvuk (autoplay pravila) — uvodne poruke kreću odmah
                unlockSfx();
                voice.stop(); voice.enqueue(['G01', 'G02', 'G03', 'G04']);
                startCamera(); setStep('detecting');
              }} disabled={!faceMesh}>
                {faceMesh ? <><IcoCameraBtn /><span>Započni merenje</span></> : 'Učitavanje...'}
              </button>
            </div>

            {/* Footer */}
            <p style={{ width: 256, alignSelf: 'center', color: '#66738c', fontSize: 12, fontWeight: 700, lineHeight: 1.5, textAlign: 'center' }}>
              <span style={{ fontWeight: 400 }}>Oznake možete fino pomerati strelicama; lupa se pojavljuje pri prevlačenju<br /></span>
              Merenje se dešava u vašem browseru, svi podaci ostaju na vašem uređaju
            </p>
          </div>
        </div>
      )}

      {/* ── DETECTING ── */}
      {step === 'detecting' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontWeight: 500 }}>

          {/* Warning badges */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 12, minHeight: 32, padding: '0 4px' }}>
            {faceStatus === 'far' && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '9px 10px', borderRadius: 8, background: '#664700', color: '#ffd94d', fontWeight: 500 }}>
                ↔ Priđite kameri
              </div>
            )}
            {faceStatus === 'close' && (
              <div style={{ display: 'flex', padding: '9px 10px', borderRadius: 8, background: '#661414', color: '#f66', fontWeight: 500 }}>
                ↔ Odmaknite se malo
              </div>
            )}
            {faceStatus === 'pose' && (
              <div style={{ display: 'flex', padding: '9px 10px', borderRadius: 8, background: '#664700', color: '#ffd94d', fontWeight: 500 }}>
                ↻ Ispravite glavu, pogled pravo u kameru
              </div>
            )}
            {faceStatus.startsWith('card-') && (
              <div style={{ display: 'flex', padding: '9px 10px', borderRadius: 8, background: '#664700', color: '#ffd94d', fontWeight: 500 }}>
                ▭ {faceStatus === 'card-missing' ? 'Ne vidim karticu' : faceStatus === 'card-high' ? 'Kartica je previsoko' : 'Prislonite karticu uz čelo'}
              </div>
            )}
            {faceStatus === 'dark' && (
              <div style={{ display: 'flex', padding: '9px 10px', borderRadius: 8, background: '#664700', color: '#ffd94d', fontWeight: 500 }}>
                ☀ Premalo svetla
              </div>
            )}
          </div>

          {/* Camera — full width, 3:4 */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', overflow: 'hidden', background: '#050508', borderRadius: 20 }}>
            {/* Face guide oval */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -52%)',
              width: '65%', height: '75%', borderRadius: '50%',
              border: `3px dashed ${faceStatus === 'good' ? '#00b8ff' : 'rgba(255,255,255,0.25)'}`,
              pointerEvents: 'none', zIndex: 9, transition: 'border-color 0.3s',
            }} />
            {countdown !== null && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 96, fontWeight: 900, color: '#00b8ff', zIndex: 20, textShadow: '0 0 40px rgba(0,184,255,0.9)', lineHeight: 1 }}>
                {countdown === 0 ? '📸' : countdown}
              </div>
            )}
            <video ref={videoRef} playsInline muted />
            <canvas ref={canvasRef} />
            {debug && <DebugOverlay live={liveDbg} camera={cameraInfoRef.current} delegate={delegateRef.current} phantom={phantom} />}

            {/* Status bar — inside camera, bottom */}
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 8, zIndex: 10,
              background: 'rgba(0,0,0,0.6)', padding: '6px 16px', borderRadius: 20,
              color: '#fff', fontSize: 13, whiteSpace: 'nowrap',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: faceStatus === 'good' ? '#00b8ff' : '#ff4040', boxShadow: faceStatus === 'good' ? '0 0 6px #00b8ff' : '0 0 6px #ff4040' }} />
              {!faceDetected ? 'Pozicionirajte lice'
                : faceStatus === 'far' ? 'Priđite kameri'
                : faceStatus === 'close' ? 'Odmaknite se malo'
                : faceStatus === 'pose' ? 'Ispravite glavu, pogled pravo u kameru'
                : faceStatus === 'dark' ? 'Premalo svetla — okrenite se ka svetlu'
                : faceStatus.startsWith('card-') ? 'Kartica na čelu, iznad obrva'
                : countdown !== null ? 'Ostanite mirni...'
                : 'Odlično! Ostanite mirni'}
            </div>

            {/* Face not detected badge — inside camera */}
            {!faceDetected && cameraReady && (
              <div style={{
                position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(89,20,20,0.9)', color: '#ff8080',
                fontSize: 13, fontWeight: 500, padding: '7px 16px', borderRadius: 20,
                zIndex: 10, whiteSpace: 'nowrap',
              }}>
                ✕&nbsp; Lice nije detektovano
              </div>
            )}
          </div>

          <Caption caption={caption} large={settings.largeText} />

          {/* Cancel button */}
          <button className="btn-secondary" onClick={reset} style={{ marginTop: 4, marginBottom: 24 }}>
            Otkaži
          </button>
        </div>
      )}

      {/* ── RESULT ── */}
      {step === 'result' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '36px 12px 49px' }}>

          <IcoResultHeader />

          <div style={{ width: 'min(320px, 100%)', marginLeft: 10, display: 'flex', flexDirection: 'column', gap: 28 }}>

            {/* Done icon + label */}
            <div style={{ width: 113, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, alignSelf: 'center', fontSize: 13, fontWeight: 500, color: '#999' }}>
              <IcoDone />
              <span>Merenje završeno</span>
            </div>

            {/* PD card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center', background: '#222', padding: '31px 23px', border: '1px solid rgba(0,184,255,0.2)', borderRadius: 20, color: '#999' }}>
              <p style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.455, letterSpacing: '1.09px', textTransform: 'uppercase' }}>Vaše PD rastojanje</p>
              <div style={{ width: 165, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', alignSelf: 'center' }}>
                <span style={{ color: '#00b8ff', fontSize: Number.isInteger(finalPD) ? 80 : 64, fontWeight: 700, lineHeight: 1.1 }}>{formatPd(finalPD)}</span>
                <span style={{ color: '#666', fontSize: 28, fontWeight: 600, lineHeight: 3.143 }}>mm</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 400 }}>Normalan opseg: 48–80 mm</p>
            </div>

            {/* Out of range warning */}
            {finalPD != null && (finalPD < 48 || finalPD > 80) && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: 'rgba(255,153,0,0.1)', padding: '13px 30px 13px 15px', border: '1px solid rgba(255,153,0,0.4)', borderRadius: 12 }}>
                <span style={{ color: '#ffd94d', fontSize: 18 }}>⚠️</span>
                <p style={{ flexGrow: 1, color: '#ffb24d', fontSize: 13, lineHeight: 1.385 }}>
                  Rezultat van opsega 48–80 mm. Pokušajte ponovo ili posetite optičara.
                </p>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 16, lineHeight: 1.5 }}>
              {sentToParent ? (
                <>
                  <p style={{ fontSize: 13, color: '#8c8c8c', textAlign: 'center' }}>
                    Vrednost {formatPd(finalPD)} mm je upisana u vaš recept u konfiguratoru.
                  </p>
                  <button className="btn-secondary" onClick={() => { setSentToParent(false); reset(); }}>Izmeri ponovo</button>
                </>
              ) : showManualCopy ? (
                <>
                  <p style={{ fontSize: 13, color: '#8c8c8c', textAlign: 'center' }}>
                    {copyOk
                      ? 'Vrednost je kopirana u clipboard. Zatvorite ovaj tab i nalepite je gde je potrebno.'
                      : `Zabeležite vrednost: ${formatPd(finalPD)} mm — unesite je ručno.`}
                  </p>
                  <button className="btn-secondary" onClick={() => window.close()}>Zatvori tab</button>
                </>
              ) : (
                <>
                  <button className="btn-primary" onClick={() => returnValue(finalPD)}>
                    {embed === 'vizor' ? 'Upiši u konfigurator' : source === 'vto' ? 'Vrati u Optičarku' : source === 'lool' ? 'Sačuvaj i vrati se' : 'Kopiraj vrednost'}
                  </button>
                  <button className="btn-secondary" onClick={reset}>Izmeri ponovo</button>
                </>
              )}
            </div>
          </div>

          {debug && <DebugPanel report={report} phantom={phantom} onImage={snapshotUrl ? () => downloadAnnotated(true) : null} onImageRaw={snapshotUrl ? () => downloadAnnotated(false) : null} />}

          <p style={{ marginTop: 60, alignSelf: 'stretch', fontSize: 10, fontWeight: 600, lineHeight: 1.6, letterSpacing: '0.79px', textTransform: 'uppercase', textAlign: 'center', color: '#999' }}>
            Brinemo o vašim očima i vašoj privatnosti
          </p>
        </div>
      )}

      </div>{/* end MAX_W wrapper */}
      {a11yPanel}
    </div>
  );
};

export default PDMeasurement;
