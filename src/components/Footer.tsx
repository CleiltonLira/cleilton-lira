import { MapPin } from 'lucide-react';
import { useApp } from '../store';

export function Footer() {
  const { settings } = useApp();
  
  return (
    <footer className="bg-stone-900 text-stone-400 py-12 mt-auto">
      <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="text-center md:text-left">
          <h3 className="font-serif text-white text-xl mb-2">{settings.name}</h3>
          <p className="text-sm flex items-center justify-center md:justify-start gap-2">
            <MapPin size={14} /> {settings.address}
          </p>
        </div>
        
        <div className="text-sm">
          <span>{settings.instagram}</span> • <span>{settings.phone}</span>
        </div>
      </div>
    </footer>
  );
}
