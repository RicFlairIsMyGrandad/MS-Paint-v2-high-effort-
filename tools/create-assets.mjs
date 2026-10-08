import { writeFileSync } from "node:fs";
const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="green" x2="0" y2="1"><stop stop-color="#b3dc57"/><stop offset="1" stop-color="#398348"/></linearGradient><linearGradient id="wood" x2="1" y2="1"><stop stop-color="#c99053"/><stop offset="1" stop-color="#7e4829"/></linearGradient><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#ffe275"/><stop offset="1" stop-color="#d88f13"/></linearGradient></defs><g stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const artworks = {
  tree: '<path d="M51 112 54 62h20l4 50 10 7H38l13-7Z" fill="url(#wood)" stroke="#593d25" stroke-width="3"/><path d="m64 87-15-25m16 13 19-17" fill="none" stroke="#654224" stroke-width="5"/><g fill="url(#green)" stroke="#38643b" stroke-width="2.5"><path d="M19 53C8 34 26 18 39 26 36 7 66 5 73 21c20-15 39 1 33 18 22 7 13 33-5 35 2 20-25 29-39 14-14 12-37 3-34-13-19 1-24-17-9-22Z"/><path d="M37 40q8-18 22-12m17 3q16-4 22 8M24 56q12 10 26 1m19 12q16 7 27-4" fill="none" stroke="#d4eb85" stroke-width="4"/></g><path d="m43 117 9-5m26 7-7-6" stroke="#e5bc7a" stroke-width="2"/>',
  house:
    '<path d="M19 58h92v57H19Z" fill="#dfca88" stroke="#716345" stroke-width="3"/><path d="m12 61 45-47 61 47Z" fill="#526d81" stroke="#324e63" stroke-width="3"/><path d="m57 14 8 47H12Z" fill="#6e93a4"/><path d="M87 37V17h12v31" fill="#b98d62" stroke="#5d584c" stroke-width="3"/><path d="M31 84h19v31H31Z" fill="url(#wood)" stroke="#745035" stroke-width="2"/><path d="M70 72h26v22H70Zm-42-7h17v12H28Z" fill="#a7dbe2" stroke="#536c64" stroke-width="3"/><path d="M83 72v22m-13-11h26m-55-18v12" stroke="#6a705d" stroke-width="2"/><path d="M12 119h106l-10-9H23Z" fill="#83a44e"/>',
  chair:
    '<path d="m33 66-3-52 43-6 3 55-43 3Z" fill="url(#wood)" stroke="#5e3928" stroke-width="3"/><path d="m39 19 28-5 2 41-28 4Z" fill="#a86d3d" stroke="#794329" stroke-width="2"/><path d="m28 63 48-7 26 19-52 11-22-23Z" fill="#c58b52" stroke="#603c29" stroke-width="3"/><path d="m50 86 1 33m43-41 1 37M30 66l2 39m45-45 2 43" stroke="#64422e" stroke-width="8"/><path d="m50 85 43-9" stroke="#ecd0a3" stroke-width="2"/>',
  treasure:
    '<path d="M17 57q0-29 25-30h50q22 0 22 30v48H17V57Z" fill="url(#wood)" stroke="#6c451e" stroke-width="3"/><path d="M17 57h97v48H17Z" fill="#ab672c"/><path d="M17 58h98v10H17Zm0 39h98v9H17ZM26 33l9-5v76H24Zm64-6h10v78H89Z" fill="url(#gold)" stroke="#a9721b" stroke-width="2"/><path d="M54 58h20v24H54Z" fill="url(#gold)" stroke="#7c591b" stroke-width="2"/><path d="M61 66h6v10h-6Z" fill="#715524"/><path d="m37 41 45 0" stroke="#daaa70" stroke-width="3"/>',
  cloud:
    '<path d="M21 91C-2 85 5 62 23 62 18 37 40 25 57 40 68 11 103 24 104 47c30-4 35 42 9 43L21 91Z" fill="#effaff" stroke="#85b6e2" stroke-width="2.5"/><path d="M21 66q-5 14 9 17m10-41q16-5 21 12m12-17q20-4 24 15m4 13q14-5 16 8" fill="none" stroke="#c6e4f7" stroke-width="5"/>',
  grass:
    '<path d="M6 106q59-36 116-1l-16 10-24-3-21 7-24-4-20 1Z" fill="#589331" stroke="#457926" stroke-width="2"/><path d="m12 106 13-37 6 23 8-42 8 42 13-51 8 50 13-47 7 45 13-27 1 36 16-11-8 24Z" fill="url(#green)" stroke="#739c28" stroke-width="2"/><path d="m40 104 7-19m15 24 4-36m21 33 5-20" stroke="#cee276" stroke-width="3"/>',
  rock: '<path d="m9 102 8-49 32-32 39 4 29 47-6 35-52 8Z" fill="#899594" stroke="#515f61" stroke-width="3"/><path d="m17 53 32-32 9 42-24 16Zm41 10 30-38 29 47-29 17Z" fill="#bcc3bf"/><path d="m34 79 24-16 30 26-29 26Z" fill="#6d7a78"/><path d="m9 102 25-23 25 36Z" fill="#9da9a2"/><path d="m70 37 5 22m23 18 6 14" stroke="#d5dad4" stroke-width="3"/>',
};
for (const [name, body] of Object.entries(artworks))
  writeFileSync("assets/demo/" + name + ".svg", svg(body));
writeFileSync(
  "assets/icon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect x="8" y="8" width="240" height="240" rx="46" fill="#0879e6"/><path d="M52 178c-9-35 14-84 63-95 48-10 91 5 95 41 3 25-33 40-58 27-22-13-19 28-31 39-24 19-64 15-69-12Z" fill="#fff4d2"/><circle cx="89" cy="126" r="15" fill="#1847f1"/><circle cx="124" cy="108" r="14" fill="#f8515c"/><circle cx="161" cy="113" r="14" fill="#ffbf20"/><circle cx="177" cy="140" r="12" fill="#44b37a"/><path d="m79 208 64-111 17 10-63 111Z" fill="#7d4427"/><path d="m143 97 17 10 17-31-18-11Z" fill="#b7c5d7"/><path d="m158 67 17 11 9-27-26 16Z" fill="#f69635"/></svg>`,
);
