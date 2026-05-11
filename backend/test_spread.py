"""Quick test to check disease spread rate over 55 steps / 30 months."""
from sca_engine import SCAEngine
import numpy as np

e = SCAEngine()
env = e.compute_env('black_sigatoka', 26, 85, 'medium')
print('p_base:', env['p_base'])
print('E_ENV:', env['E_ENV'])

grid = np.zeros((100, 160), dtype=np.uint8)
intensity = np.zeros((100, 160), dtype=np.float32)
e.seed_grid(grid, intensity, 'black_sigatoka', False, None, None, None, None)

lc = int(np.sum(e.leaf_mask))
ts = 55
print(f'Leaf cells: {lc}')
print(f'Initial infected: {np.sum(grid >= 1)}')

for s in range(ts + 1):
    ic = int(np.sum((grid == 1) & e.leaf_mask))
    nc = int(np.sum((grid == 2) & e.leaf_mask))
    m = round(s / ts * 30)
    total = (ic + nc) / lc * 100
    print(f'step {s:2d}  month {m:2d}:  inf={ic/lc*100:5.1f}%  nec={nc/lc*100:5.1f}%  total={total:5.1f}%')
    if total >= 99.9:
        print(f'  >>> SATURATED at step {s} / month {m}')
        break
    if s < ts:
        grid, intensity = e._step(grid, intensity, False, env['p_base'], s, ts, float(env['E_ENV']))
