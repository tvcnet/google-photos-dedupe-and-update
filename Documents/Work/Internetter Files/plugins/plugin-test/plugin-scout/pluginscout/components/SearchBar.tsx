import React, { useState, useRef } from 'react';
import { MagnifyingGlassIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface SearchBarProps {
  onSearch: (term: string) => void;
  onUpload: (file: File) => void;
  isLoading: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onSearch, onUpload, isLoading }) => {
  const [term, setTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (term.trim()) {
      onSearch(term);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.name.endsWith('.zip')) {
        onUpload(file);
      } else {
        alert('Please select a valid .zip file');
      }
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto my-8 space-y-4">
      <form onSubmit={handleSubmit} className="relative group z-10">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <MagnifyingGlassIcon className="w-6 h-6 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
        </div>
        <input
          type="text"
          className="block w-full p-5 pl-12 text-lg text-slate-900 border border-slate-200 rounded-2xl bg-white shadow-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
          placeholder="Enter plugin slug (e.g., 'elementor') or URL..."
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading || !term.trim()}
          className="absolute right-3 top-3 bottom-3 px-6 bg-brand-600 text-white font-medium rounded-xl hover:bg-brand-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing
            </span>
          ) : (
            'Evaluate'
          )}
        </button>
      </form>
      
      <div className="flex items-center justify-between text-sm text-slate-500 px-2">
        <div className="flex gap-2">
          Try: <button onClick={() => setTerm('woocommerce')} className="text-brand-600 hover:underline">woocommerce</button>,{' '}
          <button onClick={() => setTerm('contact-form-7')} className="text-brand-600 hover:underline">contact-form-7</button>
        </div>
        
        <div className="flex items-center gap-2">
            <span>or</span>
            <input 
                type="file" 
                accept=".zip" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange}
            />
            <button 
                type="button"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-slate-600 hover:text-brand-600 font-medium transition-colors disabled:opacity-50"
            >
                <ArrowUpTrayIcon className="w-4 h-4" />
                Upload .zip
            </button>
        </div>
      </div>
    </div>
  );
};