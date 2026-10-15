"use client";

import { useEffect, useState } from "react";
import { fetchClinicalPhotoBlob } from "../services/document-api-service";
import { documentErrorMessage } from "../services/document-display";

export function PrivateClinicalImage({
  photoId,
  alt,
  className,
  thumbnail = false,
}: {
  photoId: number | string;
  alt: string;
  className?: string;
  thumbnail?: boolean;
}) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    async function load() {
      setError("");
      setSrc("");
      try {
        const response = await fetchClinicalPhotoBlob(photoId, thumbnail ? "thumbnail" : "view");
        if (!active) return;
        objectUrl = URL.createObjectURL(response.blob);
        setSrc(objectUrl);
      } catch (cause) {
        if (active) setError(documentErrorMessage(cause));
      }
    }

    void load();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId, thumbnail]);

  if (error) return <div className={className} role="alert">{error}</div>;
  if (!src) return <div className={className} role="status">Chargement sécurisé…</div>;

  // Authenticated clinical files are exposed only as temporary object URLs.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt={alt} />;
}
