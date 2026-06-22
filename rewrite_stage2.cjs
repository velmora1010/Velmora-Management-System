const fs = require('fs');
let lines = fs.readFileSync('src/modules/inventory/production/ProductionBatchDetail.tsx', 'utf8').split('\n');

let startIndex = -1;
let endIndex = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('STAGE 2: MICRO BATCHES EXECUTION')) {
    startIndex = i;
  }
  if (lines[i].includes('SCAN INGREDIENT MODAL')) {
    endIndex = i - 1;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  const newBlock = `      {/* STAGE 2: MICRO BATCHES EXECUTION */}
      {!isFullyComplete && productionBatch.status !== 'Saved' && showMicroBatches && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '20px', margin: 0, color: 'white', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 700 }}>
              <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>2</span>
              Micro Batches Execution
            </h2>
          </div>

          {/* SUMMARY CARDS */}
          <div className="grid grid-4" style={{ gap: '16px', marginBottom: '32px' }}>
            <div style={{ background: '#111827', padding: '20px', borderRadius: '16px', border: '1px solid #263244' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Total</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'white' }}>{totalMB}</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#10b981', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Passed</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#10b981' }}>{passedCount}</div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#ef4444', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Failed</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>{failedCount}</div>
            </div>
            <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <div style={{ fontSize: '12px', color: '#f59e0b', textTransform: 'uppercase', fontWeight: 600, marginBottom: '8px' }}>Waiting</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#f59e0b' }}>{waitingCount}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
            {microBatches.sort((a,b) => a.micro_batch_no - b.micro_batch_no).map((mb, index) => {
              const isPrevCompleted = index === 0 || microBatches.find(m => m.micro_batch_no === mb.micro_batch_no - 1)?.status !== 'Waiting';
              const isCurrent = isPrevCompleted && mb.status === 'Waiting';

              return (
                <div 
                  key={mb.id} 
                  style={{ 
                    background: isCurrent ? '#1e293b' : '#111827', 
                    border: \`1px solid \${isCurrent ? '#3b82f6' : '#263244'}\`,
                    padding: '20px 24px', 
                    borderRadius: '16px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    boxShadow: isCurrent ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
                    transition: 'all 0.2s',
                    opacity: (!isCurrent && mb.status === 'Waiting') ? 0.6 : 1
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: isCurrent ? '#3b82f6' : '#1e293b', color: isCurrent ? 'white' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold' }}>
                      MB{mb.micro_batch_no}
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '4px' }}>Quantity</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: 'white' }}>{mb.units} <span style={{ fontSize: '14px', fontWeight: 'normal', color: '#64748b' }}>units</span></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {mb.status === 'Waiting' && !isCurrent && (
                      <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, padding: '6px 12px', borderRadius: '12px', background: '#0f172a' }}>Waiting for previous</span>
                    )}
                    
                    {mb.status === 'Waiting' && isCurrent && pendingBarcodeMB?.id !== mb.id && (
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          className="btn hover-lift" 
                          style={{ padding: '10px 24px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} 
                          onClick={() => { setFailingMicroBatch(mb); setFailModalOpen(true); }}
                        >
                          <X size={16} /> Fail
                        </button>
                        <button 
                          className="btn hover-lift" 
                          style={{ padding: '10px 24px', borderRadius: '10px', background: '#10b981', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }} 
                          onClick={() => handlePassQCClick(mb)}
                        >
                          <Check size={16} strokeWidth={3} /> Pass
                        </button>
                      </div>
                    )}

                    {pendingBarcodeMB?.id === mb.id && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch', width: '100%', marginTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#f59e0b', fontWeight: 'bold' }}>Barcode Ready - Review and Save</span>
                        </div>
                        
                        <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #1e293b' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {pendingBarcodesList.map((bc, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#1e293b', borderRadius: '8px', border: '1px solid #334155' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ background: 'white', padding: '4px', borderRadius: '4px' }}>
                                    <Barcode value={bc.no} width={1} height={20} fontSize={10} margin={0} displayValue={false} />
                                  </div>
                                  <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'white' }}>{bc.no}</span>
                                </div>
                                <div>
                                  <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 600 }}>PENDING</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px' }}>
                          <button 
                            className="btn hover-lift" 
                            style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', color: '#94a3b8', border: '1px solid #334155', fontWeight: 600 }} 
                            onClick={handleCancelBarcode}
                          >
                            Cancel
                          </button>
                          <button 
                            className="btn hover-lift" 
                            style={{ padding: '8px 16px', borderRadius: '8px', background: '#10b981', color: 'white', border: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }} 
                            onClick={() => handleSaveBarcode(mb)}
                          >
                            <CheckCircle2 size={16} /> Save Barcode
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

`;

  lines.splice(startIndex, endIndex - startIndex + 1, newBlock);
  fs.writeFileSync('src/modules/inventory/production/ProductionBatchDetail.tsx', lines.join('\\n'));
  console.log('Fixed STAGE 2!');
} else {
  console.log('Failed to find markers.');
}
