
import React from 'react';
import { Table, TableStatus } from '../types';
import { Link, Users, Star } from 'lucide-react';

interface TableMapProps {
  tables: Table[];
  statuses: Map<string, TableStatus>;
}

const TableMap: React.FC<TableMapProps> = ({ tables, statuses }) => {
  const getStatusColor = (status: TableStatus) => {
    switch(status) {
      case TableStatus.FREE: return 'bg-emerald-900/40 border-emerald-500/50 text-emerald-100 hover:bg-emerald-800/50';
      case TableStatus.OCCUPIED: return 'bg-rose-900/40 border-rose-500/50 text-rose-100 opacity-80';
      case TableStatus.SELECTED: return 'bg-amber-500/30 border-amber-400 text-amber-100 animate-pulse ring-2 ring-amber-400/50 shadow-[0_0_15px_rgba(251,191,36,0.3)]';
      default: return 'bg-slate-700 border-slate-600';
    }
  };

  return (
    <div className="relative w-full max-w-2xl glass-panel rounded-xl p-4 mx-auto bg-slate-900/80">
      
      {/* Legend */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 text-[9px] text-slate-400 font-mono z-10 pointer-events-none">
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Libero</div>
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Occupato</div>
        <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Selezionato IA</div>
        <div className="flex items-center gap-1.5 mt-1"><span className="w-4 border-t border-dashed border-slate-400"></span> Combinabile</div>
      </div>
      
      <div className="mb-4 border-b border-slate-700 pb-2">
          <h3 className="text-sm font-serif text-slate-200">Piantina Sala</h3>
          <p className="text-[10px] text-slate-500">Stato Live & Configurazione</p>
      </div>

      <div className="grid grid-cols-4 grid-rows-3 gap-3 aspect-[16/10] relative">
        
        {/* Render Connection Lines for Combinable Tables */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-40">
            {tables.map(t1 => {
                if (!t1.isCombinable) return null;
                return t1.combinableWith.map(t2Id => {
                    const t2 = tables.find(t => t.id === t2Id);
                    if (!t2 || t1.id > t2.id) return null; // Draw once per pair
                    
                    // Simple logic to find center of grid cells
                    // Assuming 4x4 grid and consistent gaps. 
                    // 25% width per col, 33% height per row roughly.
                    const x1 = (t1.x * 25 + 12.5) + '%';
                    const y1 = (t1.y * 33.33 + 16.5) + '%';
                    const x2 = (t2.x * 25 + 12.5) + '%';
                    const y2 = (t2.y * 33.33 + 16.5) + '%';
                    
                    return (
                        <line key={`${t1.id}-${t2.id}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1.5" strokeDasharray="3 3" />
                    );
                });
            })}
        </svg>

        {tables.map((table) => {
          const status = statuses.get(table.id) || TableStatus.FREE;
          const statusClasses = getStatusColor(status);
          
          return (
            <div 
              key={table.id}
              className={`relative flex flex-col items-center justify-center border transition-all duration-300 z-10 p-1
                ${statusClasses}
                ${table.shape === 'round' ? 'rounded-[24px]' : 'rounded-lg'}
                hover:scale-[1.02] cursor-help group
              `}
              style={{
                gridColumnStart: table.x + 1,
                gridRowStart: table.y + 1,
              }}
              title={`Tavolo ${table.name}: Capacità ${table.minCapacity}-${table.maxCapacity}`}
            >
              {/* Combinable Indicator */}
              {table.isCombinable && (
                  <div className="absolute -top-1.5 -right-1.5 bg-slate-800 text-slate-400 rounded-full p-0.5 border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Combinable">
                      <Link size={8} />
                  </div>
              )}

              <div className="text-center pointer-events-none">
                <div className="font-bold text-[10px] md:text-sm tracking-tight truncate w-full px-1">{table.name}</div>
                <div className="flex items-center justify-center gap-0.5 text-[9px] md:text-xs opacity-70 mt-0.5">
                    <Users size={10} />
                    <span>{table.minCapacity}-{table.maxCapacity}</span>
                </div>
              </div>
              
              {/* Selection Star */}
              {status === TableStatus.SELECTED && (
                  <div className="absolute -top-2 -left-2 text-amber-400 animate-bounce drop-shadow-lg">
                      <Star size={18} fill="currentColor" />
                  </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TableMap;
