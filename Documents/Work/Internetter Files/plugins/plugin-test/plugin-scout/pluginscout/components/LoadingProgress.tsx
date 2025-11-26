import React from 'react';
import { AnalysisState } from '../types';
import { BeakerIcon, CloudArrowDownIcon, GlobeAltIcon, DocumentMagnifyingGlassIcon, CheckIcon } from '@heroicons/react/24/outline';

interface LoadingProgressProps {
  status: AnalysisState['status'];
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({ status }) => {
  const steps = [
    { id: 'loading_metadata', label: 'Fetching Metadata', icon: CloudArrowDownIcon },
    { id: 'downloading_code', label: 'Downloading Source Code', icon: DocumentMagnifyingGlassIcon },
    { id: 'searching_web', label: 'Web Intelligence Recon', icon: GlobeAltIcon },
    { id: 'analyzing_ai', label: 'AI Security Audit', icon: BeakerIcon },
  ];

  const getCurrentStepIndex = () => {
    switch (status) {
      case 'loading_metadata': return 0;
      case 'downloading_code': return 1;
      case 'searching_web': return 2;
      case 'analyzing_ai': return 3;
      case 'complete': return 4;
      default: return -1;
    }
  };

  const currentStepIndex = getCurrentStepIndex();
  
  // Calculate approximate percentage for the progress bar
  let progressPercent = 0;
  if (currentStepIndex === 0) progressPercent = 15;
  else if (currentStepIndex === 1) progressPercent = 40;
  else if (currentStepIndex === 2) progressPercent = 65;
  else if (currentStepIndex === 3) progressPercent = 90;
  else if (currentStepIndex === 4) progressPercent = 100;

  return (
    <div className="w-full max-w-lg mx-auto mt-8 animate-fade-in">
        {/* Main Progress Bar */}
        <div className="relative pt-1 mb-6">
            <div className="flex mb-2 items-center justify-between">
                <div>
                    <span className="text-xs font-bold inline-block py-1 px-3 uppercase rounded-full text-brand-600 bg-brand-50">
                        {status === 'complete' ? 'Complete' : 'Analyzing'}
                    </span>
                </div>
                <div className="text-right">
                    <span className="text-xs font-bold inline-block text-brand-600">
                        {progressPercent}%
                    </span>
                </div>
            </div>
            <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-slate-100 shadow-inner">
                <div style={{ width: `${progressPercent}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-brand-500 transition-all duration-700 ease-out relative overflow-hidden">
                    <div className="absolute inset-0 w-full h-full animate-progress-stripes" style={{
                        backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', 
                        backgroundSize: '1rem 1rem'
                    }}></div>
                </div>
            </div>
        </div>

        {/* Steps Visualizer */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden transform transition-all">
            {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;
                const Icon = step.icon;

                return (
                    <div key={step.id} className={`p-4 flex items-center gap-4 border-b border-slate-50 last:border-0 transition-colors duration-300 ${isCurrent ? 'bg-brand-50/30' : ''}`}>
                         <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                             isCompleted ? 'bg-green-500 text-white scale-100' :
                             isCurrent ? 'bg-white border-2 border-brand-500 text-brand-600 scale-110 shadow-lg' :
                             'bg-slate-50 text-slate-300 border border-slate-100'
                         }`}>
                             {isCompleted ? (
                                 <CheckIcon className="w-6 h-6" />
                             ) : (
                                 <Icon className={`w-5 h-5 ${isCurrent ? 'animate-pulse' : ''}`} />
                             )}
                         </div>
                         <div className="flex-grow">
                             <h4 className={`text-sm font-semibold transition-colors duration-300 ${isCompleted || isCurrent ? 'text-slate-900' : 'text-slate-400'}`}>
                                 {step.label}
                             </h4>
                             <div className="h-4 overflow-hidden relative">
                                {isCurrent && (
                                    <p className="text-xs text-brand-600 font-medium absolute top-0 left-0 animate-fade-in-up">
                                        Processing...
                                    </p>
                                )}
                                {isCompleted && (
                                    <p className="text-xs text-green-600 font-medium absolute top-0 left-0">
                                        Completed
                                    </p>
                                )}
                             </div>
                         </div>
                    </div>
                );
            })}
        </div>
        
        <p className="text-center text-xs text-slate-400 mt-6 animate-pulse">
            Using Google Gemini 1.5 Pro to analyze code & security intelligence...
        </p>
    </div>
  );
};
