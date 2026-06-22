import fs from 'fs';
const file = 'src/modules/inventory/InventoryRoom.tsx';
let content = fs.readFileSync(file, 'utf8');

const closeIndex = content.lastIndexOf('Close');

if (closeIndex > -1) {
  content = content.substring(0, closeIndex) + `Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
        </>
      )}
    </motion.div>
  );
};

class ErrorBoundary extends Component<{children: React.ReactNode}, { hasError: boolean }> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Something went wrong while loading Inventory Room.</h2>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Clear Search</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function InventoryRoomWrapper() {
  return (
    <ErrorBoundary>
      <InventoryRoom />
    </ErrorBoundary>
  );
}
`;
  fs.writeFileSync(file, content);
  console.log('Fixed end of file');
} else {
  console.log('Could not find Close');
}
