import PropTypes from 'prop-types';
import React from 'react';
import AccountForm from './AccountForm';

class EnrollForm extends React.Component {
  static propTypes = {
    params: PropTypes.shape({
      token: PropTypes.string.isRequired,
    }).isRequired,
  };

  render() {
    return <AccountForm format="enroll" token={this.props.params.token} />;
  }
}

export default EnrollForm;
