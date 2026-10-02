import styles from "./PhoneRotation.module.css";

export default function PhoneRotation() {
  return <span className={styles.phone} aria-hidden="true">
    <span className={styles.screen} />
    <span className={styles.speaker} />
  </span>;
}
