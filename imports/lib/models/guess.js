import { huntsMatchingCurrentUser } from '../../model-helpers';
import GuessesSchema from '../schemas/guess';
import Base from './base';
import ActiveOperatorRole from '../active-operator-role';

const Guesses = new Base('guesses');
Guesses.attachSchema(GuessesSchema);
Guesses.publish(huntsMatchingCurrentUser);

// Operators can update guesses
ActiveOperatorRole.allow('mongo.guesses.update', () => true);

export default Guesses;
