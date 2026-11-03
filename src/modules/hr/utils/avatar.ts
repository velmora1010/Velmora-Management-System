/**
 * Avatar & Initials Utilities for Human Resources Management System
 */

export const getInitials = (name?: string): string => {
  if (!name || !name.trim()) return 'HR';
  const clean = name.trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'HR';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  const first = parts[0][0] || '';
  const last = parts[parts.length - 1][0] || '';
  return (first + last).toUpperCase() || 'HR';
};

/**
 * Generates an SVG data URL containing a professional initials avatar
 * using the system theme colors (#EBF3FA background and #206DA6 text).
 */
export const getInitialsAvatar = (name?: string): string => {
  const initials = getInitials(name);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <rect width="128" height="128" rx="32" fill="#EBF3FA"/>
    <text x="50%" y="54%" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" font-size="44" font-weight="700" fill="#206DA6" text-anchor="middle" dominant-baseline="middle">${initials}</text>
  </svg>`.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Validates file format and size for profile photos.
 * Supported: JPG, JPEG, PNG, WEBP. Max size: 5 MB.
 */
export const validateProfilePhoto = (
  file: File
): { isValid: boolean; error?: string } => {
  const allowedExtensions = /\.(jpe?g|png|webp)$/i;
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  const matchesType = allowedMimeTypes.includes(file.type);
  const matchesExt = allowedExtensions.test(file.name);

  if (!matchesType && !matchesExt) {
    return {
      isValid: false,
      error: 'Invalid file format. Please upload JPG, JPEG, PNG, or WEBP only.',
    };
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  if (file.size > MAX_BYTES) {
    return {
      isValid: false,
      error: 'File size exceeds 5 MB. Please select an image under 5 MB.',
    };
  }

  return { isValid: true };
};

/**
 * Reads an image file and optimizes it into a high-quality data URL (max 512x512)
 * to ensure persistent client storage without quota bottlenecks.
 */
export const processProfileImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 512;
        let { width, height } = img;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const optimized = canvas.toDataURL(mime, 0.92);
          resolve(optimized);
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
};
