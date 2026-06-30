import React from 'react';

const VideoBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 w-full h-full -z-10 overflow-hidden bg-[#a6d8f8]">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
      >
        <source src="/back.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {/* Subtle overlay to ensure the neobrutalism UI remains clean and readable */}
      <div className="absolute inset-0 bg-black/10 mix-blend-multiply pointer-events-none" />
    </div>
  );
};

export default React.memo(VideoBackground);
