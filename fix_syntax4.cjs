const fs = require('fs');
let content = fs.readFileSync('src/modules/inventory/production/ProductionBatchDetail.tsx', 'utf8');

const broken = `                            ))}
          </div>
        </motion.div>
      )}`;

const fixed = `                            ))}
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
      )}`;

content = content.replace(broken, fixed);
fs.writeFileSync('src/modules/inventory/production/ProductionBatchDetail.tsx', content);
