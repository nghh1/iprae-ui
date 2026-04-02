import { useState } from 'react';
import { Info } from 'lucide-react';

export const InfoTooltip = ({ text, align = "center", side = "top" }) => {
  const [isOpen, setIsOpen] = useState(false);

  let alignClass = "left-1/2 -translate-x-1/2";
  let arrowClass = "left-1/2 -translate-x-1/2";
  
  if (align === "left") {
    alignClass = "left-0";
    arrowClass = "left-2";
  } else if (align === "right") {
    alignClass = "right-0";
    arrowClass = "right-2";
  }

  const isTop = side === "top";
  const sideClass = isTop ? "bottom-full mb-2" : "top-full mt-2";
  const arrowSideClass = isTop ? "top-full border-t-slate-800" : "bottom-full border-b-slate-800";

  return (
    <span 
      tabIndex={0}
      className="relative inline-flex items-center justify-center ml-1.5 cursor-pointer z-50 outline-none"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onClick={() => setIsOpen(!isOpen)}
      onBlur={() => setIsOpen(false)}
    >
      <Info className={`w-3.5 h-3.5 transition-colors ${isOpen ? 'text-blue-500' : 'text-slate-400'}`} />
      
      {isOpen && (
        <span className={`absolute ${sideClass} ${alignClass} w-max max-w-[220px] sm:max-w-[260px] p-2.5 bg-slate-800 text-white text-xs rounded-md shadow-xl text-left font-normal normal-case tracking-normal leading-relaxed pointer-events-none`}>
          {text}
          <span className={`absolute ${arrowSideClass} ${arrowClass} border-4 border-transparent`}></span>
        </span>
      )}
    </span>
  );
};