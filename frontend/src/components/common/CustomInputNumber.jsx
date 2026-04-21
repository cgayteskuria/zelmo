import { InputNumber } from "antd";

export default function CustomInputNumber({
    value,
    onChange,
    min = 0,
    precision = 2,
    ...props
}) {
    return (
        <InputNumber
            {...props}
            value={value}
            onChange={onChange}
            controls={false}
            min={min}
            precision={precision}
            decimalSeparator=","
            style={{ width: "100%" }}           
            formatter={(value) =>
                value !== undefined && value !== null
                    ? value
                          .toString()
                          .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
                    : ""
            }
            parser={(value) =>
                value
                    ? value.replace(/\s/g, "").replace(",", ".")
                    : ""
            }
        />
    );
}
