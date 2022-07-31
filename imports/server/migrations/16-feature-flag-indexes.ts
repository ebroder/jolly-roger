import FeatureFlags from '../../lib/models/FeatureFlags';
import Migrations from './Migrations';

Migrations.add({
  version: 16,
  name: 'Create index for feature flags',
  up() {
    FeatureFlags.createIndex({ name: 1 }, { unique: true });
  },
});
