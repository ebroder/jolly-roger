import React, {
  useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

interface ModalFormProps {
  title: string;
  submitLabel?: string;
  submitStyle?: string;
  submitDisabled?: boolean;
  onSubmit: (callback: () => void) => void;
  children: React.ReactNode;
}

export type ModalFormHandle = {
  show: () => void;
  hide: () => void;
}

const ModalForm = React.forwardRef((
  props: ModalFormProps,
  forwardedRef: React.Ref<ModalFormHandle>,
) => {
  const [isShown, setIsShown] = useState<boolean>(false);
  const dontTryToHide = useRef<boolean>(false);

  const show = useCallback(() => {
    setIsShown(true);
  }, []);

  const hide = useCallback(() => {
    setIsShown(false);
  }, []);

  useImperativeHandle(forwardedRef, () => ({
    show,
    hide,
  }));

  useEffect(() => {
    dontTryToHide.current = false;
    return () => {
      dontTryToHide.current = true;
    };
  }, []);

  const { onSubmit } = props;
  const submit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(() => {
      // For delete forms, it's possible that the component gets
      // deleted and unmounted before the callback gets called.
      if (!dontTryToHide.current) {
        hide();
      }
    });
  }, [onSubmit, hide]);

  const submitLabel = props.submitLabel || 'Save';
  const submitStyle = props.submitStyle || 'primary';

  // Note: the animation=false is working around a regression in
  // react-bootstrap that otherwise breaks autofocus:
  // https://github.com/react-bootstrap/react-bootstrap/issues/5102
  // There's a way to avoid breaking things without losing animation,
  // but then we'd need to hold a ref to the `autoFocus` child to explicitly
  // focus it in the Modal's `onEntered` callback, and from within this
  // class we don't know which of the children should receive focus. So
  // we just disable animations for now.  Makes the UI feel snappier anyway.
  return (
    <Modal
      animation={false}
      show={isShown}
      onHide={hide}
    >
      <form className="form-horizontal" onSubmit={submit}>
        <Modal.Header closeButton>
          <Modal.Title>
            {props.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {props.children}
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="light"
            onClick={hide}
            disabled={props.submitDisabled}
          >
            Close
          </Button>
          <Button
            variant={submitStyle}
            type="submit"
            disabled={props.submitDisabled}
          >
            {submitLabel}
          </Button>
        </Modal.Footer>
      </form>
    </Modal>
  );
});

export default ModalForm;
