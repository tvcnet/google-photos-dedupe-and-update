import React, { useState } from 'react';
import { WPPluginRawData, AIAnalysisResult } from '../types';
import { ScoreGauge } from './ScoreGauge';
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  ShieldCheckIcon, 
  CloudArrowDownIcon,
  CalendarDaysIcon,
  StarIcon,
  CodeBracketIcon,
  BugAntIcon,
  GlobeAltIcon,
  LinkIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/solid';

interface AnalysisReportProps {
  plugin: WPPluginRawData;
  analysis: AIAnalysisResult;
}

export const AnalysisReport: React.FC<AnalysisReportProps> = ({ plugin, analysis }) => {
  const [showFiles, setShowFiles] = useState(false);
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const isLocal = plugin.isLocal === true;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-fade-in">
      
      {/* Header Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {plugin.banner_low && (
          <div className="h-32 w-full bg-slate-100 relative">
             <img src={plugin.banner_high || plugin.banner_low} alt="Banner" className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
          </div>
        )}
        <div className="p-8 flex flex-col md:flex-row items-start md:items-center gap-8 relative">
          <div className="flex-shrink-0 -mt-16 md:mt-0 bg-white p-2 rounded-2xl shadow-lg">
             <ScoreGauge score={analysis.score} />
          </div>
          
          <div className="flex-grow">
            <div className="flex items-center gap-3 mb-2">
                <h2 className="text-3xl font-bold text-slate-900">{plugin.name}</h2>
                {isLocal && <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-xs font-mono text-slate-500">LOCAL UPLOAD</span>}
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                    analysis.verdict === 'Excellent' ? 'bg-green-50 text-green-700 border-green-200' :
                    analysis.verdict === 'Good' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    analysis.verdict === 'Caution' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                    'bg-red-50 text-red-700 border-red-200'
                }`}>
                    {analysis.verdict}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
                    analysis.codeQualityRating === 'A' || analysis.codeQualityRating === 'B' ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                }`}>
                    Code Grade: {analysis.codeQualityRating}
                </span>
            </div>
            <p className="text-slate-500 mb-4">by <span dangerouslySetInnerHTML={{ __html: plugin.author }} className="font-medium text-slate-700" /></p>
            <p className="text-slate-600 leading-relaxed max-w-2xl">{analysis.summary}</p>
          </div>

          {!isLocal && (
            <div className="flex flex-col gap-3 min-w-[200px]">
                <a 
                    href={`https://wordpress.org/plugins/${plugin.slug}/`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium text-sm"
                >
                    View on WP.org
                </a>
                <div className="text-xs text-slate-400 text-center">Version {plugin.version}</div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Metrics & Stats */}
        <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Vital Stats</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-slate-600">
                            <CloudArrowDownIcon className="w-5 h-5 text-slate-400" />
                            <span>Active Installs</span>
                        </div>
                        <span className="font-semibold text-slate-900">{isLocal ? 'N/A' : `${plugin.active_installs.toLocaleString()}+`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-slate-600">
                            <CalendarDaysIcon className="w-5 h-5 text-slate-400" />
                            <span>Last Updated</span>
                        </div>
                        <span className="font-semibold text-slate-900">{formatDate(plugin.last_updated)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-slate-600">
                            <StarIcon className="w-5 h-5 text-yellow-400" />
                            <span>Rating</span>
                        </div>
                        <span className="font-semibold text-slate-900">{isLocal ? 'N/A' : `${plugin.rating / 20}/5 (${plugin.num_ratings})`}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-slate-600">
                            <ShieldCheckIcon className="w-5 h-5 text-slate-400" />
                            <span>Tested Up To</span>
                        </div>
                        <span className="font-semibold text-slate-900">WP {plugin.tested}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Gemini Risk Audit</h3>
                <div className="space-y-4">
                   <div>
                       <div className="text-xs font-medium text-slate-500 mb-1">Security Perspective</div>
                       <p className="text-sm text-slate-700 leading-relaxed">{analysis.securityRiskAssessment}</p>
                   </div>
                   <div className="w-full h-px bg-slate-100"></div>
                   <div>
                       <div className="text-xs font-medium text-slate-500 mb-1">Maintenance Health</div>
                       <p className="text-sm text-slate-700 leading-relaxed">{analysis.maintenanceHealth}</p>
                   </div>
                </div>
            </div>

            {analysis.externalRisks && analysis.externalRisks.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <GlobeAltIcon className="w-4 h-4" />
                        Web Intelligence
                    </h3>
                    <div className="space-y-3">
                        {analysis.externalRisks.map((risk, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <h4 className="text-sm font-semibold text-slate-900 leading-tight mb-1">{risk.title}</h4>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500">{risk.source}</span>
                                    {risk.url && (
                                        <a href={risk.url} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:text-brand-700">
                                            <LinkIcon className="w-4 h-4" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* Right Column: Code Analysis & Findings */}
        <div className="md:col-span-2 flex flex-col gap-6">
            
            {/* Vulnerabilities Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <BugAntIcon className="w-5 h-5 text-slate-600" />
                        Code Security Findings
                    </h3>
                    <span className="text-xs font-semibold bg-white border border-slate-200 px-2 py-1 rounded text-slate-500">
                        {analysis.vulnerabilities.length} Issues
                    </span>
                </div>
                
                {analysis.vulnerabilities.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-3" />
                        <h4 className="text-slate-900 font-medium">No Obvious Vulnerabilities Detected</h4>
                        <p className="text-sm text-slate-500 mt-1">Based on the files analyzed, the code appears to follow standard security practices.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {analysis.vulnerabilities.map((vuln, idx) => (
                            <div key={idx} className="p-6 hover:bg-slate-50 transition-colors">
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide border ${
                                            vuln.severity === 'Critical' ? 'bg-red-100 text-red-800 border-red-200' :
                                            vuln.severity === 'High' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                            vuln.severity === 'Medium' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                                            'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}>
                                            {vuln.severity}
                                        </span>
                                        <span className="font-semibold text-slate-900 text-sm">{vuln.issueType}</span>
                                    </div>
                                    <div className="text-xs font-mono text-slate-400">
                                        {vuln.file}:{vuln.lineNumber}
                                    </div>
                                </div>
                                <p className="text-sm text-slate-600 mb-3">{vuln.description}</p>
                                {vuln.snippet && (
                                    <div className="bg-slate-900 rounded-lg p-3 overflow-x-auto">
                                        <code className="text-xs font-mono text-green-400 whitespace-pre">
                                            {vuln.snippet.trim()}
                                        </code>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pros & Cons */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex-grow">
                 <h3 className="text-lg font-bold text-slate-900 mb-6">Qualitative Analysis</h3>
                 
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div>
                        <h4 className="flex items-center gap-2 text-green-700 font-semibold mb-3">
                            <CheckCircleIcon className="w-5 h-5" />
                            Strengths
                        </h4>
                        <ul className="space-y-3">
                            {analysis.pros.map((pro, idx) => (
                                <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>
                                    {pro}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <h4 className="flex items-center gap-2 text-red-700 font-semibold mb-3">
                            <ExclamationTriangleIcon className="w-5 h-5" />
                            Weaknesses & Risks
                        </h4>
                        <ul className="space-y-3">
                            {analysis.cons.map((con, idx) => (
                                <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0"></span>
                                    {con}
                                </li>
                            ))}
                        </ul>
                    </div>
                 </div>
            </div>
            
            {/* Scan Scope - Transparency Report */}
            {plugin.sourceCodeFiles && plugin.sourceCodeFiles.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                     <button 
                        onClick={() => setShowFiles(!showFiles)}
                        className="flex items-center justify-between w-full text-left"
                     >
                         <span className="text-sm font-semibold text-slate-600 flex items-center gap-2">
                            <CodeBracketIcon className="w-4 h-4" />
                            Scan Scope: {plugin.sourceCodeFiles.length} Files Analyzed
                         </span>
                         {showFiles ? <ChevronUpIcon className="w-4 h-4 text-slate-400"/> : <ChevronDownIcon className="w-4 h-4 text-slate-400"/>}
                     </button>
                     
                     {showFiles && (
                         <div className="mt-4 pt-4 border-t border-slate-200">
                             <p className="text-xs text-slate-500 mb-3">
                                 Due to AI processing limits, a subset of the most critical files (logic, admin, API) were selected for deep analysis.
                             </p>
                             <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                 {plugin.sourceCodeFiles.map((f, idx) => (
                                     <li key={idx} className="text-xs font-mono text-slate-600 truncate" title={f.name}>
                                         {f.name}
                                     </li>
                                 ))}
                             </ul>
                         </div>
                     )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};