type PopupGeometry = {
  width: number;
  height: number;
  left: number;
  top: number;
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

const computePopupGeometry = (opener: Window = window): PopupGeometry => {
  const { screen } = opener;
  const availW = screen.availWidth || screen.width;
  const availH = screen.availHeight || screen.height;
  const availLeft = (screen as Screen & { availLeft?: number }).availLeft ?? 0;
  const availTop = (screen as Screen & { availTop?: number }).availTop ?? 0;

  const width = Math.min(
    clamp(Math.round(availW * 0.5), 600, 900),
    availW || 600
  );
  const height = Math.min(
    clamp(Math.round(availH * 0.8), 600, 900),
    availH || 600
  );

  const left = clamp(
    Math.round(opener.screenX + ((opener.outerWidth || availW) - width) / 2),
    availLeft,
    Math.max(availLeft, availLeft + availW - width)
  );
  const top = clamp(
    Math.round(opener.screenY + ((opener.outerHeight || availH) - height) / 2),
    availTop,
    Math.max(availTop, availTop + availH - height)
  );

  return { width, height, left, top };
};

export const getPopupFeatures = (opener: Window = window): string => {
  const { width, height, left, top } = computePopupGeometry(opener);
  return `popup=yes,width=${width},height=${height},left=${left},top=${top},scrollbars=yes`;
};
